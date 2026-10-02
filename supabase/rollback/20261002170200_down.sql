-- Rollback de 20261002170200_tasks_soft_delete.sql
begin;

drop index if exists public.tasks_deleted_at_idx;

alter table public.tasks
  drop column if exists deleted_at,
  drop column if exists deleted_by;

commit;
