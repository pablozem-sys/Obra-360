-- =====================================================================
-- Piloto interno del agente de WhatsApp — sesión de conversación
-- persistida por número. Migración puramente ADITIVA.
--
-- Reemplaza el intento original de guardar la sesión en memoria del
-- proceso (Map en whatsapp-agente/index.ts): los logs de staging
-- mostraron que la Edge Function arranca "fría" en casi cada
-- invocación real (cada mensaje trae su propio evento "booted"), así
-- que esa memoria no sobrevivía de un mensaje al siguiente — el bot
-- se re-presentaba en cada respuesta. Con esta tabla, la sesión vive
-- en la base y sobrevive reinicios de la función.
-- =====================================================================
begin;

create table if not exists public.whatsapp_sesiones (
  phone_e164       text primary key,
  mensajes         jsonb not null default '[]'::jsonb,
  ultima_actividad timestamptz not null default now()
);

comment on table public.whatsapp_sesiones is
  'Historial de conversación (solo texto limpio, sin bloques tool_use/'
  'tool_result) del piloto de WhatsApp, por número de teléfono. RLS '
  'habilitado pero SIN policies (deny-all) — solo la Edge Function '
  'whatsapp-agente, con service_role, la lee/escribe.';

alter table public.whatsapp_sesiones enable row level security;

commit;

-- =====================================================================
-- ROLLBACK — revierte esta migración completa, sin afectar nada más.
-- =====================================================================
-- begin;
-- drop table if exists public.whatsapp_sesiones;
-- commit;
