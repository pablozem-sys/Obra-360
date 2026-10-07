-- =====================================================================
-- Asignación de tareas a una persona puntual. Hoy `tasks` solo tiene
-- empresa_id/obra_id -- no hay forma de saber "esto es mío" sin abrir
-- toda la lista de la empresa. Migración puramente ADITIVA (NULL =
-- sigue siendo una tarea general de la empresa, se sigue mostrando a
-- todos -- no rompe nada existente).
-- =====================================================================
begin;

alter table public.tasks
  add column if not exists asignado_a uuid null references public.users(id);

comment on column public.tasks.asignado_a is
  'A quién se le asignó la tarea (public.users.id). NULL = tarea general '
  'de la empresa, visible para todos (comportamiento de antes de esta '
  'columna). El recordatorio diario por WhatsApp y buscar_tareas(soloMias) '
  'muestran: asignado_a IS NULL OR asignado_a = la persona.';

create index if not exists tasks_asignado_a_idx on public.tasks (asignado_a);

commit;
