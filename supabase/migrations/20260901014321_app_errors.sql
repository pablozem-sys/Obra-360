-- =====================================================================
-- Instrumentación de errores + panel interno de monitoreo (/monitoreo).
-- Migración puramente ADITIVA — no toca ninguna tabla, columna, policy ni
-- función existente. Rollback completo comentado al final del archivo.
-- =====================================================================
begin;

create table if not exists public.app_errors (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null,
  mensaje      text not null,
  stack        text,
  origen       text not null,            -- 'ui' | 'data' | 'auth' | 'storage' | 'unhandled' | 'promise'
  operacion    text,                     -- nombre de la función que falló, ej. 'createGasto'
  severidad    text not null default 'error',
  ruta         text,                     -- location.pathname
  user_id      uuid,
  empresa_id   uuid,
  rol          text,
  user_agent   text,
  online       boolean,
  app_version  text,
  contexto     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.app_errors is
  'Tabla de PLATAFORMA, no de tenant — es la única excepción deliberada al '
  'aislamiento multi-empresa del resto del sistema. Guarda empresa_id como '
  'metadato (para saber qué empresa lo sufrió) pero su lectura NO se filtra '
  'por empresa: quien tiene acceso ve errores de VA y VR por igual. El '
  'acceso se controla en la policy de SELECT (allowlist de emails), no por '
  'tiene_acceso_empresa()/es_dueno_empresa() como el resto del esquema.';

create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_fp_idx on public.app_errors (fingerprint, created_at desc);

-- ---------------------------------------------------------------------
-- Vista agregada por fingerprint para el panel /monitoreo.
-- ---------------------------------------------------------------------
create or replace view public.app_errors_resumen as
select
  fingerprint,
  (array_agg(mensaje order by created_at desc))[1]   as mensaje,
  (array_agg(origen order by created_at desc))[1]    as origen,
  (array_agg(operacion order by created_at desc))[1] as operacion,
  count(*)                                           as total,
  min(created_at)                                    as primera_vez,
  max(created_at)                                    as ultima_vez,
  count(distinct user_id)                            as usuarios_distintos,
  count(distinct empresa_id)                         as empresas_distintas
from public.app_errors
group by fingerprint;

-- ---------------------------------------------------------------------
-- RPC de logging. SECURITY DEFINER para poder insertar sin policy de
-- INSERT (corre con privilegios del owner, que sortea RLS de la tabla) y
-- para funcionar SIN sesión (kiosco, pantalla de login antes de auth).
-- Nunca lanza — cualquier error interno se traga en el EXCEPTION handler,
-- nunca llega al cliente.
-- ---------------------------------------------------------------------
create or replace function public.log_app_error(
  p_fingerprint text,
  p_mensaje     text,
  p_stack       text default null,
  p_origen      text default 'unhandled',
  p_operacion   text default null,
  p_severidad   text default 'error',
  p_ruta        text default null,
  p_empresa_id  uuid default null,
  p_rol         text default null,
  p_user_agent  text default null,
  p_online      boolean default true,
  p_app_version text default null,
  p_contexto    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reciente_count int;
begin
  if p_fingerprint is null or p_mensaje is null then
    return;
  end if;

  -- Anti-abuso: si ya hay 20+ filas de este mismo fingerprint en el
  -- último minuto, no sigue insertando (deja de crecer sin límite si algo
  -- entra en loop de errores).
  select count(*) into v_reciente_count
  from public.app_errors
  where fingerprint = p_fingerprint
    and created_at > now() - interval '1 minute';

  if v_reciente_count >= 20 then
    return;
  end if;

  insert into public.app_errors (
    fingerprint, mensaje, stack, origen, operacion, severidad, ruta,
    user_id, empresa_id, rol, user_agent, online, app_version, contexto
  ) values (
    p_fingerprint,
    left(p_mensaje, 500),
    left(p_stack, 4000),
    coalesce(p_origen, 'unhandled'),
    p_operacion,
    coalesce(p_severidad, 'error'),
    p_ruta,
    auth.uid(),
    p_empresa_id,
    p_rol,
    left(p_user_agent, 300),
    coalesce(p_online, true),
    p_app_version,
    case
      when p_contexto is null then '{}'::jsonb
      when pg_column_size(p_contexto) > 2000 then '{"_truncado": true}'::jsonb
      else p_contexto
    end
  );

  -- Limpieza probabilística (≈1 de cada 200 llamadas) — sin pg_cron por ahora.
  if random() < 0.005 then
    delete from public.app_errors where created_at < now() - interval '30 days';
  end if;
exception when others then
  -- Nunca propagar el error de logging al cliente que está reportando OTRO error.
  return;
end;
$$;

grant execute on function public.log_app_error(
  text, text, text, text, text, text, text, uuid, text, text, boolean, text, jsonb
) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS: sin policy de INSERT (el insert entra solo por la RPC de arriba,
-- que corre como owner y sortea RLS). Policy de SELECT por allowlist de
-- email — decisión tomada con Pedro 2026-09-01: lista de emails hardcodeada
-- en vez de tabla nueva o rol en user_companies, porque app_errors es
-- explícitamente de plataforma, no de tenant (ver comment de la tabla).
-- ---------------------------------------------------------------------
alter table public.app_errors enable row level security;

create policy "solo_admins_leen_app_errors" on public.app_errors
for select to authenticated
using (auth.jwt() ->> 'email' = any (array['pablozem@gmail.com']));

grant select on public.app_errors to authenticated;
grant select on public.app_errors_resumen to authenticated;

commit;

-- =====================================================================
-- ROLLBACK — revierte esta migración completa, sin afectar nada más.
-- =====================================================================
-- begin;
-- drop policy if exists "solo_admins_leen_app_errors" on public.app_errors;
-- drop function if exists public.log_app_error(
--   text, text, text, text, text, text, text, uuid, text, text, boolean, text, jsonb
-- );
-- drop view if exists public.app_errors_resumen;
-- drop table if exists public.app_errors;
-- commit;
