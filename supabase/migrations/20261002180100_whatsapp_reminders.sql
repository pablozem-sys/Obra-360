-- =====================================================================
-- Recordatorios diarios por WhatsApp (tipo "resumen_tareas"). Migración
-- puramente ADITIVA. Rollback en
-- supabase/rollback/20261002180100_down.sql
--
-- NOTA sobre una diferencia encontrada con el pedido original: el pedido
-- no incluía forma de distinguir "primer intento de envío falló" de
-- "segundo intento (el reintento) también falló" -- necesario para
-- cumplir "no avanza next_run_at más de 1 reintento". Se agrega
-- `last_error_at` (no estaba en la lista de columnas pedida) con ese
-- único propósito -- reportado acá y en la respuesta al usuario, no
-- escondido.
-- =====================================================================
begin;

create table if not exists public.whatsapp_reminders (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.companies(id),
  whatsapp_user_id  uuid not null references public.whatsapp_users(id),
  tipo              text not null check (tipo in ('resumen_tareas')),
  hora_local        time not null,
  dias              smallint[] not null default '{1,2,3,4,5}',
  zona_horaria      text not null default 'America/Santiago',
  activo            boolean not null default true,
  next_run_at       timestamptz not null,
  last_sent_at      timestamptz null,
  last_error_at     timestamptz null,
  created_at        timestamptz not null default now(),
  unique (whatsapp_user_id, tipo)
);

comment on table public.whatsapp_reminders is
  'Recordatorios diarios por WhatsApp. Catálogo de tipo fijo a propósito '
  '(check tipo in (resumen_tareas)) -- cualquier automatización nueva '
  'futura necesita su propia migración, nunca un valor libre.';
comment on column public.whatsapp_reminders.dias is
  'Días ISO en los que corre: 1=lunes .. 7=domingo.';
comment on column public.whatsapp_reminders.last_error_at is
  'Puesto por enviar_recordatorios cuando un envío falla. Si ya estaba '
  'seteado y falla de nuevo, se da por perdido el reintento (se limpia y '
  'se avanza a next_run_at del próximo día programado) -- nunca más de 1 '
  'reintento, como se pidió. No estaba en el modelo de datos original.';

create index if not exists whatsapp_reminders_next_run_idx
  on public.whatsapp_reminders (next_run_at) where activo;

-- ---------------------------------------------------------------------
-- RLS: habilitado y forzado. A diferencia de whatsapp_users/whatsapp_sesiones
-- (deny-all), acá SÍ hay una policy real de SELECT -- pedido explícito,
-- para dejar la puerta abierta a una futura pantalla de administración
-- que liste recordatorios sin pasar por la Edge Function. Nunca
-- is_dueno() (chequea el rol global, no la empresa de esta fila) -- el
-- chequeo de "dueño" va siempre atado al empresa_id de la fila.
-- Escritura: solo la Edge Function, con service_role (bypassa RLS por
-- diseño de Postgres) -- sin policies de insert/update/delete acá.
-- ---------------------------------------------------------------------
alter table public.whatsapp_reminders enable row level security;
alter table public.whatsapp_reminders force row level security;

create policy "whatsapp_reminders_select_owner_or_dueno_empresa" on public.whatsapp_reminders
for select to authenticated
using (
  exists (
    select 1 from public.whatsapp_users wu
    where wu.id = whatsapp_reminders.whatsapp_user_id and wu.user_id = auth.uid()
  )
  or exists (
    select 1 from public.user_companies uc
    where uc.empresa_id = whatsapp_reminders.empresa_id
      and uc.user_id = auth.uid()
      and uc.rol = 'dueno'
  )
);

-- ---------------------------------------------------------------------
-- Reclamo atómico de recordatorios vencidos, para enviar_recordatorios.
-- FOR UPDATE SKIP LOCKED (pedido explícito) + el avance temporal de
-- next_run_at quedan en la MISMA sentencia -- dos invocaciones del cron
-- en simultáneo nunca pueden reclamar la misma fila (la segunda ve el
-- next_run_at ya adelantado por la primera y no matchea el where). El
-- avance de +10 min es solo un resguardo por si la Edge Function se cae
-- a mitad de camino -- el procesamiento normal lo pisa enseguida con el
-- valor real calculado por calcularNextRunAt().
-- ---------------------------------------------------------------------
create or replace function public.reclamar_recordatorios_pendientes()
returns setof public.whatsapp_reminders
language sql
as $$
  with candidatos as (
    select id from public.whatsapp_reminders
    where activo and next_run_at <= now()
    for update skip locked
  )
  update public.whatsapp_reminders r
  set next_run_at = now() + interval '10 minutes'
  from candidatos c
  where r.id = c.id
  returning r.*;
$$;

revoke all on function public.reclamar_recordatorios_pendientes() from public;
grant execute on function public.reclamar_recordatorios_pendientes() to service_role;

-- ---------------------------------------------------------------------
-- pg_net (envíos HTTP desde Postgres) -- primera vez que se usa en este
-- proyecto, igual que pg_cron (ver 20261002170100_whatsapp_processed_messages.sql).
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Cron cada 5 minutos → invoca enviar_recordatorios. El secreto
-- compartido vive en Supabase Vault (vault.create_secret, corrido aparte
-- contra producción, nunca en una migración versionada -- el valor real
-- del secreto no debe quedar en texto plano en git). Si el secreto
-- todavía no existe cuando esto corre, el header sale null y la Edge
-- Function lo rechaza -- falla cerrado, nunca abierto.
-- URL hardcodeada a propósito: es específica de ESTE proyecto
-- (ffxexpasoneowquvtouz, VAION producción) -- pedido explícito de no
-- tocar VRION, así que no hace falta parametrizarla.
-- ---------------------------------------------------------------------
select cron.schedule(
  'enviar_recordatorios_whatsapp',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ffxexpasoneowquvtouz.supabase.co/functions/v1/enviar_recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

commit;
