-- =====================================================================
-- Dedup persistente de mensajes entrantes de Meta (agente de WhatsApp).
-- El dedup en memoria (MENSAJES_PROCESADOS, whatsapp-agente/index.ts) se
-- pierde en cada cold start de la Edge Function -- esta tabla es la
-- fuente de verdad real, la memoria queda como primera capa (evita un
-- round-trip a la base en la mayoría de los reintentos, que llegan
-- mientras la misma instancia sigue tibia).
-- Migración puramente ADITIVA. Rollback en
-- supabase/rollback/20261002170100_down.sql
-- =====================================================================
begin;

create table if not exists public.whatsapp_processed_messages (
  message_id    text primary key,
  empresa_id    uuid null,
  processed_at  timestamptz not null default now()
);

comment on table public.whatsapp_processed_messages is
  'Un mensaje de WhatsApp (message_id de Meta) solo se procesa una vez, '
  'sin importar reintentos de Meta ni cold starts de la Edge Function. '
  'empresa_id queda null a propósito: el dedup corre ANTES de resolver '
  'acceso (resolverAcceso), que es lo que recién determina la empresa -- '
  'no se agrega un segundo viaje a la base solo para completarlo después. '
  'RLS deny-all: solo la Edge Function whatsapp-agente, con service_role, '
  'la usa.';

-- ---------------------------------------------------------------------
-- RLS: deny-all deliberado y forzado -- sin policies para anon ni
-- authenticated. FORCE además de ENABLE para que ni siquiera el dueño de
-- la tabla la lea sin pasar explícito por alto RLS.
-- ---------------------------------------------------------------------
alter table public.whatsapp_processed_messages enable row level security;
alter table public.whatsapp_processed_messages force row level security;

-- ---------------------------------------------------------------------
-- Limpieza diaria vía pg_cron -- primera vez que se usa en este proyecto
-- (app_errors usa limpieza probabilística in-process por no tener esto
-- configurado todavía, ver comentario en 20260901014321_app_errors.sql).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'whatsapp_processed_messages_cleanup',
  '0 3 * * *', -- 03:00 UTC todos los días
  $$ delete from public.whatsapp_processed_messages where processed_at < now() - interval '7 days'; $$
);

commit;
