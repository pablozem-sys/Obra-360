-- =====================================================================
-- Instrumentación de uso del asistente IA (tokens de entrada/salida por
-- consulta, en-app y WhatsApp) — para poder estimarle costo al cliente.
-- Migración puramente ADITIVA — no toca ninguna tabla, columna, policy ni
-- función existente. Rollback completo comentado al final del archivo.
-- =====================================================================
begin;

create table if not exists public.asistente_uso (
  id             uuid primary key default gen_random_uuid(),
  canal          text not null,            -- 'in-app' | 'whatsapp'
  model          text not null,            -- ej. 'claude-sonnet-5'
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  empresa_id     uuid,
  created_at     timestamptz not null default now()
);

comment on table public.asistente_uso is
  'Tabla de PLATAFORMA (mismo criterio que app_errors) — guarda empresa_id '
  'como metadato pero el acceso de lectura se controla por allowlist de '
  'email, no por empresa. Un registro por respuesta final del asistente '
  '(suma de todas las rondas de tool-use de esa consulta), no por llamada '
  'individual a Anthropic.';

create index if not exists asistente_uso_created_idx on public.asistente_uso (created_at desc);

-- ---------------------------------------------------------------------
-- RPC de logging. SECURITY DEFINER para insertar sin policy de INSERT y
-- para funcionar tanto con JWT de usuario (asistente-busqueda) como con
-- service_role (whatsapp-agente, sin sesión de Supabase Auth). Nunca
-- lanza — un fallo acá no debe romper la respuesta real al usuario.
-- ---------------------------------------------------------------------
create or replace function public.log_asistente_uso(
  p_canal          text,
  p_model          text,
  p_input_tokens   integer,
  p_output_tokens  integer,
  p_empresa_id     uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_empresa_id uuid;
begin
  v_empresa_id := p_empresa_id;

  -- Si no vino empresa_id explícito (caso asistente-busqueda, corre con
  -- JWT de usuario real), resolverlo desde user_companies vía auth.uid().
  if v_empresa_id is null then
    select uc.empresa_id into v_empresa_id
    from public.user_companies uc
    where uc.user_id = auth.uid()
    limit 1;
  end if;

  insert into public.asistente_uso (canal, model, input_tokens, output_tokens, empresa_id)
  values (
    coalesce(p_canal, 'in-app'),
    p_model,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    v_empresa_id
  );
exception when others then
  return;
end;
$$;

grant execute on function public.log_asistente_uso(text, text, integer, integer, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Vista agregada por mes y canal — la lee /monitoreo para estimar costo.
-- ---------------------------------------------------------------------
create or replace view public.asistente_uso_resumen as
select
  date_trunc('month', created_at) as mes,
  canal,
  count(*)              as consultas,
  sum(input_tokens)      as input_tokens,
  sum(output_tokens)     as output_tokens
from public.asistente_uso
group by 1, 2
order by 1 desc;

-- ---------------------------------------------------------------------
-- RLS: sin policy de INSERT (entra solo por la RPC de arriba, que corre
-- como owner). Policy de SELECT por la misma allowlist de email que
-- app_errors — decisión: reusar el mismo criterio de "plataforma, no
-- tenant" ya establecido, no crear un mecanismo de permisos nuevo.
-- ---------------------------------------------------------------------
alter table public.asistente_uso enable row level security;

create policy "solo_admins_leen_asistente_uso" on public.asistente_uso
for select to authenticated
using (auth.jwt() ->> 'email' = any (array['pablozem@gmail.com']));

grant select on public.asistente_uso to authenticated;
grant select on public.asistente_uso_resumen to authenticated;

commit;

-- =====================================================================
-- ROLLBACK — revierte esta migración completa, sin afectar nada más.
-- =====================================================================
-- begin;
-- drop policy if exists "solo_admins_leen_asistente_uso" on public.asistente_uso;
-- drop view if exists public.asistente_uso_resumen;
-- drop function if exists public.log_asistente_uso(text, text, integer, integer, uuid);
-- drop table if exists public.asistente_uso;
-- commit;
