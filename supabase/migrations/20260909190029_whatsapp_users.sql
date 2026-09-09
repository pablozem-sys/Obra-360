-- =====================================================================
-- Piloto interno del agente de WhatsApp — Fase 1 (solo lectura).
-- Migración puramente ADITIVA — no toca ninguna tabla, columna, policy ni
-- función existente. Rollback completo comentado al final del archivo.
-- =====================================================================
begin;

create table if not exists public.whatsapp_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id),
  empresa_id   uuid not null,
  phone_e164   text not null unique,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.whatsapp_users is
  'Registro de números de WhatsApp habilitados para el piloto del agente. '
  'empresa_id se declara explícito al dar de alta el número (Pablo, alta '
  'manual) — nunca se infiere del mensaje ni lo decide el modelo. RLS '
  'habilitado pero SIN policies (deny-all): la Edge Function whatsapp-agente '
  'es la única que la lee, y lo hace con la service_role key porque un '
  'mensaje de WhatsApp no trae un JWT de Supabase que RLS pueda evaluar.';

create index if not exists whatsapp_users_phone_idx on public.whatsapp_users (phone_e164);

-- ---------------------------------------------------------------------
-- RLS: deny-all deliberado. Sin policies para anon/authenticated — solo
-- la service_role (que sortea RLS por diseño de Postgres) puede leer esta
-- tabla. No otorgar grants a anon/authenticated.
-- ---------------------------------------------------------------------
alter table public.whatsapp_users enable row level security;

commit;

-- =====================================================================
-- ROLLBACK — revierte esta migración completa, sin afectar nada más.
-- =====================================================================
-- begin;
-- drop table if exists public.whatsapp_users;
-- commit;
