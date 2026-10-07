-- Rollback de 20261003140000_tasks_asignado_a.sql
begin;

drop index if exists public.tasks_asignado_a_idx;

alter table public.tasks
  drop column if exists asignado_a;

commit;
