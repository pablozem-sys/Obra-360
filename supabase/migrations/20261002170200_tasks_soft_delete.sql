-- =====================================================================
-- Borrado lógico en tasks -- eliminar_tarea (agente de WhatsApp) pasa de
-- DELETE a UPDATE deleted_at/deleted_by. Las policies RLS existentes de
-- tasks NO se tocan (siguen permitiendo DELETE a authenticated vía
-- "authenticated full access" -- queda sin uso desde el agente, pero no
-- se debilita ni se endurece nada acá).
-- Migración puramente ADITIVA. Rollback en
-- supabase/rollback/20261002170200_down.sql
-- =====================================================================
begin;

alter table public.tasks
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.users(id);

comment on column public.tasks.deleted_at is
  'Borrado lógico -- NULL = tarea activa. Puesto por eliminar_tarea del '
  'agente de WhatsApp (nunca DELETE real desde ahí) vía UPDATE server-side '
  'tras confirmación SÍ/NO. Toda lectura de tasks (tools del agente y '
  'frontend) debe filtrar deleted_at is null.';
comment on column public.tasks.deleted_by is
  'public.users.id de quien pidió el borrado (acceso.userId resuelto por '
  'whatsapp-agente vía whatsapp_users.user_id) -- nunca el número de '
  'teléfono ni un id que el modelo se haya inventado.';

create index if not exists tasks_deleted_at_idx on public.tasks (deleted_at);

commit;
