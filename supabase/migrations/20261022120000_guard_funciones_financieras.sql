-- =====================================================================
-- Funciones de agregación financiera sin control de acceso (QA 2026-10-21).
--
-- get_dashboard_kpis, get_obra_metrics, get_meses_disponibles y
-- get_flujo_caja_mensual/semanal son SECURITY DEFINER (sortean RLS),
-- reciben p_empresa_id como parámetro y no validaban quién llama. Además
-- tenían EXECUTE para anon/PUBLIC: cualquiera con la anon key y el uuid
-- de la empresa leía sus finanzas, y un administrativo podía leer el flujo
-- de caja aunque la UI se lo oculte.
--
-- Arreglo: primera sentencia de cada función = exigir_acceso_empresa(),
-- que corta con error si el usuario no pertenece a la empresa. Las
-- funciones de flujo de caja exigen rol dueño (igual que la ruta
-- /flujo-caja). service_role pasa siempre: whatsapp-agente llama
-- get_obra_metrics/get_dashboard_kpis con la service key y ya resuelve la
-- empresa a partir del teléfono que escribe.
--
-- Los cuerpos son copia exacta de la última versión (baseline y
-- 20260911140000); solo se agrega la línea del guard y search_path.
-- =====================================================================
begin;

create or replace function public.exigir_acceso_empresa(p_empresa_id uuid, p_solo_dueno boolean default false)
returns void
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;
  if p_solo_dueno then
    if not public.es_dueno_empresa(p_empresa_id) then
      raise exception 'sin acceso a la empresa' using errcode = '42501';
    end if;
  elsif not public.tiene_acceso_empresa(p_empresa_id) then
    raise exception 'sin acceso a la empresa' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.exigir_acceso_empresa(uuid, boolean) from public, anon;
grant execute on function public.exigir_acceso_empresa(uuid, boolean) to authenticated, service_role;

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
  set search_path to 'public'
  as $$
  select public.exigir_acceso_empresa(p_empresa_id);
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

CREATE OR REPLACE FUNCTION public.get_obra_metrics (
  p_empresa_id uuid
)
  RETURNS TABLE (
    project_id  uuid,
    cdo         numeric,
    costo_mod   numeric,
    adicionales numeric,
    descuentos  numeric,
    abonos      numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  set search_path to 'public'
  AS $function$
  select public.exigir_acceso_empresa(p_empresa_id);
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
$function$;

CREATE OR REPLACE FUNCTION public.get_meses_disponibles (
  p_empresa_id uuid
)
  RETURNS TABLE (
    mes text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  set search_path to 'public'
  AS $function$
  select public.exigir_acceso_empresa(p_empresa_id);
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
$function$;

CREATE OR REPLACE FUNCTION public.get_flujo_caja_mensual (
  p_empresa_id uuid,
  p_meses      integer DEFAULT 8
)
  RETURNS TABLE (
    mes      text,
    ingresos numeric,
    egresos  numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  set search_path to 'public'
  AS $function$
  select public.exigir_acceso_empresa(p_empresa_id, true);
  select
    coalesce(i.mes, e.mes) as mes,
    coalesce(i.total, 0)   as ingresos,
    coalesce(e.total, 0)   as egresos
  from (
    select to_char(fecha::date, 'YYYY-MM') as mes, sum(monto) as total
    from public.income
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) i
  full outer join (
    select to_char(fecha::date, 'YYYY-MM') as mes, sum(monto) as total
    from public.expenses
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) e on e.mes = i.mes
  order by coalesce(i.mes, e.mes) desc nulls last
  limit p_meses;
$function$;

CREATE OR REPLACE FUNCTION public.get_flujo_caja_semanal (
  p_empresa_id uuid,
  p_semanas    integer DEFAULT 8
)
  RETURNS TABLE (
    semana   date,
    ingresos numeric,
    egresos  numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  set search_path to 'public'
  AS $function$
  select public.exigir_acceso_empresa(p_empresa_id, true);
  select
    coalesce(i.semana, e.semana) as semana,
    coalesce(i.total, 0) as ingresos,
    coalesce(e.total, 0) as egresos
  from (
    select (fecha::date - extract(dow from fecha::date)::int) as semana, sum(monto) as total
    from public.income
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) i
  full outer join (
    select (fecha::date - extract(dow from fecha::date)::int) as semana, sum(monto) as total
    from public.expenses
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) e on e.semana = i.semana
  order by coalesce(i.semana, e.semana) desc nulls last
  limit p_semanas;
$function$;

revoke all on function public.get_dashboard_kpis(uuid, text) from public, anon;
grant execute on function public.get_dashboard_kpis(uuid, text) to authenticated, service_role;
revoke all on function public.get_obra_metrics(uuid) from public, anon;
grant execute on function public.get_obra_metrics(uuid) to authenticated, service_role;
revoke all on function public.get_meses_disponibles(uuid) from public, anon;
grant execute on function public.get_meses_disponibles(uuid) to authenticated, service_role;
revoke all on function public.get_flujo_caja_mensual(uuid, integer) from public, anon;
grant execute on function public.get_flujo_caja_mensual(uuid, integer) to authenticated, service_role;
revoke all on function public.get_flujo_caja_semanal(uuid, integer) from public, anon;
grant execute on function public.get_flujo_caja_semanal(uuid, integer) to authenticated, service_role;

commit;
