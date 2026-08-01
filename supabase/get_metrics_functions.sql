-- Funciones de agregación server-side para Dashboard.jsx y Obras.jsx.
-- Objetivo: reemplazar el patrón de traer TODA la historia de expenses/income/attendance/
-- additional_sales al navegador y sumarla en JS, por sumas hechas directo en Postgres
-- (GROUP BY) que devuelven solo los totales — el tamaño de la respuesta deja de crecer
-- con el historial.
--
-- IMPORTANTE: las listas de categorías CDO/GAV de abajo son una copia del objeto
-- CATEGORIAS_GASTO en src/lib/helpers.js (esa clasificación NO existe como columna en
-- la tabla `expenses`). Si se agrega/cambia una categoría en helpers.js, hay que
-- actualizar también estas funciones para que los números sigan calzando.
--
-- Aplicar en el SQL Editor de AMBOS proyectos Supabase: VAION (ffxexpasoneowquvtouz)
-- y VRION (sfemjichlximrhcfgwio).

-- ── 1. Métricas acumuladas por obra (CDO, MOD, ventas adicionales, descuentos, abonos) ──
-- Reemplaza en Obras.jsx: getExpensasPorObraLite() + getAttendanceCostsPorObra()
--   + getAllAdditionalSales() + getIngresos()
-- También reemplaza, en Dashboard.jsx, el cálculo de cdo/mod por obra usado en las
-- alertas de costo y en las barras de progreso de "Obras en Ejecución".
create or replace function public.get_obra_metrics(p_empresa_id uuid)
returns table (
  project_id  uuid,
  cdo         numeric,
  costo_mod   numeric,
  adicionales numeric,
  descuentos  numeric,
  abonos      numeric
)
language sql
stable
security definer
as $$
  select
    p.id as project_id,
    coalesce(e.cdo, 0)          as cdo,
    coalesce(a.costo_mod, 0)    as costo_mod,
    coalesce(s.adicionales, 0)  as adicionales,
    coalesce(s.descuentos, 0)   as descuentos,
    coalesce(i.abonos, 0)       as abonos
  from public.projects p
  left join (
    select project_id, sum(monto) as cdo
    from public.expenses
    where empresa_id = p_empresa_id
      and categoria in (
        'materiales', 'subcontratos', 'equipos', 'aridos', 'retiro_escombros',
        'banio_quimico', 'flete', 'otros_operacion', 'mano_obra', 'transporte'
      )
    group by project_id
  ) e on e.project_id = p.id
  left join (
    select project_id, sum(costo_total) as costo_mod
    from public.attendance
    where project_id is not null
    group by project_id
  ) a on a.project_id = p.id
  left join (
    select
      project_id,
      sum(monto) filter (where tipo <> 'descuento') as adicionales,
      sum(monto) filter (where tipo = 'descuento')  as descuentos
    from public.additional_sales
    group by project_id
  ) s on s.project_id = p.id
  left join (
    select project_id, sum(monto) as abonos
    from public.income
    where empresa_id = p_empresa_id
    group by project_id
  ) i on i.project_id = p.id
  where p.empresa_id = p_empresa_id;
$$;

-- ── 2. KPIs de empresa (Dashboard Fila 1/2), con filtro opcional por mes ──────────
-- p_month en formato 'YYYY-MM'; null = histórico completo (equivale a "Todo" en el selector).
create or replace function public.get_dashboard_kpis(p_empresa_id uuid, p_month text default null)
returns table (
  venta_adicional numeric,
  total_abonos    numeric,
  total_mano_obra numeric,
  gastos_cdo      numeric,
  gastos_gav      numeric,
  total_gastos    numeric
)
language sql
stable
security definer
as $$
  select
    coalesce((
      select sum(case when s.tipo = 'descuento' then -s.monto else s.monto end)
      from public.additional_sales s
      join public.projects p on p.id = s.project_id
      where p.empresa_id = p_empresa_id
        and (p_month is null or to_char(s.created_at, 'YYYY-MM') = p_month)
    ), 0) as venta_adicional,
    coalesce((
      select sum(i.monto)
      from public.income i
      where i.empresa_id = p_empresa_id
        and (p_month is null or to_char(i.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_abonos,
    coalesce((
      select sum(a.costo_total)
      from public.attendance a
      join public.projects p on p.id = a.project_id
      where p.empresa_id = p_empresa_id
        and (p_month is null or to_char(a.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_mano_obra,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and e.categoria in (
          'materiales', 'subcontratos', 'equipos', 'aridos', 'retiro_escombros',
          'banio_quimico', 'flete', 'otros_operacion', 'mano_obra', 'transporte'
        )
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as gastos_cdo,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and e.categoria in (
          'sueldos', 'publicidad', 'marketing', 'bencina', 'herramientas',
          'arriendo', 'cuentas', 'retiros', 'otros'
        )
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as gastos_gav,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_gastos;
$$;

-- ── 3. Meses disponibles (para el selector de mes del Dashboard) ─────────────────
create or replace function public.get_meses_disponibles(p_empresa_id uuid)
returns table (mes text)
language sql
stable
security definer
as $$
  select distinct mes from (
    select to_char(e.fecha::date, 'YYYY-MM') as mes
    from public.expenses e
    where e.empresa_id = p_empresa_id
    union
    select to_char(i.fecha::date, 'YYYY-MM')
    from public.income i
    where i.empresa_id = p_empresa_id
    union
    select to_char(a.fecha::date, 'YYYY-MM')
    from public.attendance a
    join public.projects p on p.id = a.project_id
    where p.empresa_id = p_empresa_id
    union
    select to_char(s.created_at, 'YYYY-MM')
    from public.additional_sales s
    join public.projects p on p.id = s.project_id
    where p.empresa_id = p_empresa_id
  ) meses
  where mes is not null
  order by mes desc;
$$;
