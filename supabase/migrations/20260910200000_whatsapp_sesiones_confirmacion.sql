-- =====================================================================
-- Extiende whatsapp_sesiones (creada en 20260910180000) para soportar el
-- flujo de confirmación verificado por código de crear_tarea /
-- cambiar_estado_tarea. Migración puramente ADITIVA.
--
-- 'estado' guarda si el número está esperando una confirmación SÍ/NO;
-- 'contexto' guarda el detalle exacto de la propuesta pendiente (acción,
-- obra, tarea, nuevo estado) — la ejecución real del INSERT/UPDATE en
-- `tasks` SOLO ocurre cuando el código detecta una confirmación
-- afirmativa sobre este contexto, nunca por una decisión del modelo.
-- =====================================================================
begin;

alter table public.whatsapp_sesiones
  add column if not exists estado text not null default 'idle',
  add column if not exists contexto jsonb not null default '{}'::jsonb,
  add column if not exists whatsapp_user_id uuid references public.whatsapp_users(id);

alter table public.whatsapp_sesiones
  drop constraint if exists whatsapp_sesiones_estado_check;
alter table public.whatsapp_sesiones
  add constraint whatsapp_sesiones_estado_check check (estado in ('idle', 'esperando_confirmacion_tarea'));

commit;

-- =====================================================================
-- ROLLBACK — revierte esta migración completa, sin afectar nada más.
-- =====================================================================
-- begin;
-- alter table public.whatsapp_sesiones drop constraint if exists whatsapp_sesiones_estado_check;
-- alter table public.whatsapp_sesiones
--   drop column if exists estado,
--   drop column if exists contexto,
--   drop column if exists whatsapp_user_id;
-- commit;
