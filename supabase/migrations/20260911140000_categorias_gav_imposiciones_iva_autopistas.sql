-- =====================================================================
-- Nuevas categorías de Gastos Generales (GAV): Imposiciones, IVA,
-- Autopistas. No crea columnas ni tablas — `categoria` en `expenses` es
-- texto libre, la clasificación GAV vive en el CASE embebido de
-- get_dashboard_kpis (ver supabase/get_metrics_functions.sql, que es la
-- fuente de verdad — esta migración solo actualiza esa función para que
-- gastos_gav siga calzando con total_gastos). CDO no cambia.
-- =====================================================================
begin;

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
          'arriendo', 'cuentas', 'retiros', 'imposiciones', 'iva', 'autopistas', 'otros'
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

commit;

-- =====================================================================
-- ROLLBACK — vuelve la función a la lista GAV anterior (sin las 3
-- categorías nuevas). No borra los gastos ya cargados con esas
-- categorías, solo hace que dejen de contarse en gastos_gav.
-- =====================================================================
-- begin;
-- create or replace function public.get_dashboard_kpis(p_empresa_id uuid, p_month text default null)
-- returns table (
--   venta_adicional numeric, total_abonos numeric, total_mano_obra numeric,
--   gastos_cdo numeric, gastos_gav numeric, total_gastos numeric
-- )
-- language sql stable security definer as $$
--   select
--     coalesce((select sum(case when s.tipo = 'descuento' then -s.monto else s.monto end)
--       from public.additional_sales s join public.projects p on p.id = s.project_id
--       where p.empresa_id = p_empresa_id and (p_month is null or to_char(s.created_at, 'YYYY-MM') = p_month)), 0),
--     coalesce((select sum(i.monto) from public.income i
--       where i.empresa_id = p_empresa_id and (p_month is null or to_char(i.fecha::date, 'YYYY-MM') = p_month)), 0),
--     coalesce((select sum(a.costo_total) from public.attendance a join public.projects p on p.id = a.project_id
--       where p.empresa_id = p_empresa_id and (p_month is null or to_char(a.fecha::date, 'YYYY-MM') = p_month)), 0),
--     coalesce((select sum(e.monto) from public.expenses e where e.empresa_id = p_empresa_id
--       and e.categoria in ('materiales','subcontratos','equipos','aridos','retiro_escombros','banio_quimico','flete','otros_operacion','mano_obra','transporte')
--       and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)), 0),
--     coalesce((select sum(e.monto) from public.expenses e where e.empresa_id = p_empresa_id
--       and e.categoria in ('sueldos','publicidad','marketing','bencina','herramientas','arriendo','cuentas','retiros','otros')
--       and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)), 0),
--     coalesce((select sum(e.monto) from public.expenses e where e.empresa_id = p_empresa_id
--       and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)), 0);
-- $$;
-- commit;
