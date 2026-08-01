-- Funciones de agregación server-side para FlujoCaja.jsx.
-- Mismo objetivo que get_metrics_functions.sql: hoy la página trae TODO el historial de
-- expenses/income y lo agrupa en JS por mes/semana, mostrando solo los últimos 8 períodos
-- con datos — pero igual descarga el historial completo para llegar a esos 8. Estas
-- funciones agrupan directamente en Postgres y devuelven solo los últimos N períodos.
--
-- Aplicar en el SQL Editor de AMBOS proyectos Supabase: VAION (ffxexpasoneowquvtouz)
-- y VRION (sfemjichlximrhcfgwio). No reemplaza nada de get_metrics_functions.sql,
-- son funciones adicionales.

-- ── Vista mensual ──────────────────────────────────────────────────────────────
-- Devuelve los últimos p_meses (default 8) con al menos un ingreso o egreso,
-- más recientes primero (el cliente los reordena ascendente para el gráfico).
-- IMPORTANTE: se excluyen filas con fecha NULL (igual que el código JS original,
-- que hacía `if (!g.fecha) return` antes de agrupar) — si no se excluyen, además
-- de no calzar con el original, Postgres ordena NULL primero en DESC por defecto
-- y una fila sin fecha podía "robarle" un cupo a un mes real dentro del LIMIT.
create or replace function public.get_flujo_caja_mensual(p_empresa_id uuid, p_meses int default 8)
returns table (mes text, ingresos numeric, egresos numeric)
language sql
stable
security definer
as $$
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
$$;

-- ── Vista semanal ──────────────────────────────────────────────────────────────
-- Semana = domingo a sábado (mismo criterio que el cálculo original en JS:
-- fecha - día de semana, con domingo = 0). Devuelve las últimas p_semanas (default 8).
-- Misma exclusión de fecha NULL que la vista mensual (ver comentario arriba).
create or replace function public.get_flujo_caja_semanal(p_empresa_id uuid, p_semanas int default 8)
returns table (semana date, ingresos numeric, egresos numeric)
language sql
stable
security definer
as $$
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
$$;
