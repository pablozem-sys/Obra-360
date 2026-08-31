-- =====================================================================
-- FASE 3 — cierra los 2 hallazgos diferidos de la auditoría de seguridad
-- (docs/AUDITORIA.md hallazgos #5 y #7, ver CAMBIOS.md "Pendiente Fase 3").
-- Todo en una sola transacción: si algo falla, no se aplica nada.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- PARTE 1 — Kiosco de asistencia: sesión con token en vez de RLS
-- abierta a `anon`. Ver docs/AUDITORIA.md hallazgo #5.
-- ---------------------------------------------------------------------

create table if not exists public.worker_kiosk_sessions (
  token      uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 hours'
);

create index if not exists worker_kiosk_sessions_worker_id_idx
  on public.worker_kiosk_sessions(worker_id);

-- Login de kiosco: misma validación de PIN que ya existía, ahora también
-- abre una sesión de kiosco y devuelve el token. Cambia el shape de
-- retorno (columna nueva session_token) así que hay que dropear primero
-- — `create or replace` no permite cambiar el tipo de retorno.
drop function if exists public.verify_worker_pin_only(text, text);

create function public.verify_worker_pin_only(p_pin text, p_company_slug text)
returns table(id uuid, nombre text, avatar text, valor_hora numeric, session_token uuid)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_worker record;
  v_token  uuid;
begin
  select w.id, w.nombre, w.avatar, w.valor_hora into v_worker
  from public.workers w
  join public.companies c on c.id = w.empresa_id
  where w.pin = p_pin and w.activo = true and c.slug = p_company_slug
  limit 1;

  if v_worker.id is null then
    return;
  end if;

  insert into public.worker_kiosk_sessions (worker_id)
  values (v_worker.id)
  returning worker_kiosk_sessions.token into v_token;

  return query select v_worker.id, v_worker.nombre, v_worker.avatar, v_worker.valor_hora::numeric, v_token;
end;
$$;

grant execute on function public.verify_worker_pin_only(text, text) to anon;

-- Validación interna reusada por las 4 RPC del kiosco de abajo.
create or replace function public._kiosko_valido(p_worker_id uuid, p_token uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.worker_kiosk_sessions
    where token = p_token and worker_id = p_worker_id and expires_at > now()
  );
$$;

-- Reemplaza getTodayOpenAttendance(). p_fecha la calcula el cliente con
-- localDateString() (fecha local del dispositivo) — mismo criterio que ya
-- usa registrarEntrada()/registrarSalida() hoy, no se hardcodea un huso
-- horario acá para no reintroducir el bug de fecha UTC vs local (2026-08-05).
create or replace function public.kiosko_get_estado(p_worker_id uuid, p_token uuid, p_fecha date)
returns table(
  id uuid, worker_id uuid, project_id uuid, fecha date, entrada timestamptz,
  salida timestamptz, valor_hora numeric,
  proyecto_nombre text, proyecto_direccion text
)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public._kiosko_valido(p_worker_id, p_token) then
    raise exception 'Sesión de kiosco inválida o expirada' using errcode = '28000';
  end if;

  return query
    select a.id, a.worker_id, a.project_id, a.fecha, a.entrada, a.salida, a.valor_hora::numeric,
           p.nombre, p.direccion
    from public.attendance a
    join public.projects p on p.id = a.project_id
    where a.worker_id = p_worker_id
      and a.fecha = p_fecha
      and a.salida is null
    limit 1;
end;
$$;

-- Reemplaza getWorkerObras().
create or replace function public.kiosko_get_obras(p_worker_id uuid, p_token uuid)
returns table(id uuid, nombre text, direccion text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public._kiosko_valido(p_worker_id, p_token) then
    raise exception 'Sesión de kiosco inválida o expirada' using errcode = '28000';
  end if;

  return query
    select p.id, p.nombre, p.direccion
    from public.worker_projects wp
    join public.projects p on p.id = wp.project_id
    where wp.worker_id = p_worker_id;
end;
$$;

-- Reemplaza registrarEntrada(). valor_hora se lee server-side de workers,
-- no se confía en lo que mande el cliente.
create or replace function public.kiosko_registrar_entrada(
  p_worker_id uuid, p_token uuid, p_project_id uuid, p_fecha date,
  p_lat numeric default null, p_lng numeric default null
)
returns public.attendance
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_valor_hora numeric;
  v_row public.attendance;
begin
  if not public._kiosko_valido(p_worker_id, p_token) then
    raise exception 'Sesión de kiosco inválida o expirada' using errcode = '28000';
  end if;

  select valor_hora into v_valor_hora from public.workers where id = p_worker_id;

  insert into public.attendance (worker_id, project_id, fecha, entrada, lat_entrada, lng_entrada, valor_hora)
  values (p_worker_id, p_project_id, p_fecha, now(), p_lat, p_lng, v_valor_hora)
  returning * into v_row;

  return v_row;
end;
$$;

-- Reemplaza registrarSalida(). Valida que el turno sea del mismo worker.
-- Mantiene horas/costo calculados en el cliente (mismo comportamiento de
-- hoy) — replicar la fórmula de jornada especial de sábado en SQL queda
-- fuera de alcance de esta migración.
create or replace function public.kiosko_registrar_salida(
  p_worker_id uuid, p_token uuid, p_attendance_id uuid,
  p_horas_trabajadas numeric, p_costo_total numeric,
  p_lat numeric default null, p_lng numeric default null
)
returns public.attendance
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_row public.attendance;
begin
  if not public._kiosko_valido(p_worker_id, p_token) then
    raise exception 'Sesión de kiosco inválida o expirada' using errcode = '28000';
  end if;

  update public.attendance
  set salida = now(),
      lat_salida = p_lat,
      lng_salida = p_lng,
      horas_trabajadas = p_horas_trabajadas,
      costo_total = p_costo_total
  where id = p_attendance_id and worker_id = p_worker_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Turno no encontrado' using errcode = '28000';
  end if;

  return v_row;
end;
$$;

grant execute on function public.kiosko_get_estado(uuid, uuid, date) to anon;
grant execute on function public.kiosko_get_obras(uuid, uuid) to anon;
grant execute on function public.kiosko_registrar_entrada(uuid, uuid, uuid, date, numeric, numeric) to anon;
grant execute on function public.kiosko_registrar_salida(uuid, uuid, uuid, numeric, numeric, numeric, numeric) to anon;

-- Cierra el acceso directo de `anon` a estas 3 tablas — de ahora en más
-- todo pasa por las RPC de arriba, que validan el token de sesión.
drop policy if exists "anon_insert_attend" on public.attendance;
drop policy if exists "anon_select_attend" on public.attendance;
drop policy if exists "anon_update_attend" on public.attendance;
drop policy if exists "anon_select" on public.worker_projects;
drop policy if exists "anon_read_projects" on public.projects;

-- ---------------------------------------------------------------------
-- PARTE 2 — Bucket de Storage `documents`: público → privado.
-- Ver docs/AUDITORIA.md hallazgo #7. Las policies de storage.objects para
-- `authenticated` (INSERT/SELECT/DELETE) ya existen y no cambian —
-- createSignedUrl las respeta igual que un SELECT directo.
-- ---------------------------------------------------------------------

update storage.buckets set public = false where id = 'documents';

commit;
