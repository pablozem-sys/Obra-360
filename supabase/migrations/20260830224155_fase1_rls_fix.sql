-- =====================================================================
-- FASE 1 — remediación de RLS (VAION). Migración versionada, generada a
-- partir de supabase/security_fix_2026-08-28.sql (auditoría 2026-08-28,
-- ver docs/AUDITORIA.md y docs/DATABASE.md sección "Estado real del
-- esquema"). Todo va en una sola transacción: si algo falla, no se
-- aplica nada.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. Funciones helper NUEVAS — scoped a una empresa específica, no global
--    (esto es la corrección de raíz del hallazgo #4: is_dueno()/is_administrativo()
--    existentes NO se tocan, pero dejan de usarse solas en las policies de abajo)
-- ---------------------------------------------------------------------
create or replace function public.tiene_acceso_empresa(p_empresa_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.empresa_id = p_empresa_id
      and uc.rol in ('dueno','administrativo')
  );
$$;

create or replace function public.es_dueno_empresa(p_empresa_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.empresa_id = p_empresa_id
      and uc.rol = 'dueno'
  );
$$;

-- ---------------------------------------------------------------------
-- 1. expenses (hallazgo #1) — elimina las policies abiertas que anulaban
--    el control de acceso, y re-scopea por empresa.
-- ---------------------------------------------------------------------
drop policy if exists "auth_insert" on public.expenses;
drop policy if exists "auth_select" on public.expenses;
drop policy if exists "auth_update" on public.expenses;
drop policy if exists "expenses_rls" on public.expenses;

create policy "expenses_rls" on public.expenses
for all to authenticated
using (
  tiene_acceso_empresa(empresa_id)
  or usuario_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = expenses.project_id and p.responsable_id = auth.uid())
)
with check (
  tiene_acceso_empresa(empresa_id)
  or usuario_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = expenses.project_id and p.responsable_id = auth.uid())
);

-- ---------------------------------------------------------------------
-- 2. providers (hallazgo #3) — saca el acceso público sin autenticar.
--    providers_rls (authenticated) queda intacta.
-- ---------------------------------------------------------------------
drop policy if exists "providers_all" on public.providers;

-- ---------------------------------------------------------------------
-- 3. workers (hallazgo #2 parcial + #4) — el PIN sigue visible para
--    dueño/administrativo (decisión de negocio), pero ya no se filtra
--    entre empresas. Escritura ahora exige ser dueño DE ESA empresa.
-- ---------------------------------------------------------------------
drop policy if exists "workers_select_rls" on public.workers;
create policy "workers_select_rls" on public.workers
for select to authenticated
using (tiene_acceso_empresa(empresa_id));

drop policy if exists "workers_write_rls" on public.workers;
create policy "workers_write_rls" on public.workers
for all to authenticated
using (es_dueno_empresa(empresa_id))
with check (es_dueno_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- 4. attendance — unifica VAION/VRION (hallazgo #7) y cierra el gap de
--    empresa (#4). Las policies de "anon_*" NO se tocan (Fase 3, kiosco).
-- ---------------------------------------------------------------------
drop policy if exists "attendance_auth_rls" on public.attendance;
create policy "attendance_auth_rls" on public.attendance
for all to authenticated
using (
  exists (select 1 from public.projects p where p.id = attendance.project_id and tiene_acceso_empresa(p.empresa_id))
  or exists (select 1 from public.projects p where p.id = attendance.project_id and p.responsable_id = auth.uid())
)
with check (
  exists (select 1 from public.projects p where p.id = attendance.project_id and tiene_acceso_empresa(p.empresa_id))
  or exists (select 1 from public.projects p where p.id = attendance.project_id and p.responsable_id = auth.uid())
);

-- ---------------------------------------------------------------------
-- 5. Tablas financieras / obra — cierre de hallazgo #4 tabla por tabla,
--    respetando qué ve hoy "administrativo" vs "dueño" en la app.
-- ---------------------------------------------------------------------
drop policy if exists "accounts_payable_rls" on public.accounts_payable;
create policy "accounts_payable_rls" on public.accounts_payable
for all to authenticated
using (
  tiene_acceso_empresa(empresa_id)
  or responsable_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = accounts_payable.project_id and p.responsable_id = auth.uid())
)
with check (
  tiene_acceso_empresa(empresa_id)
  or responsable_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = accounts_payable.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "accounts_receivable_rls" on public.accounts_receivable;
create policy "accounts_receivable_rls" on public.accounts_receivable
for all to authenticated
using (
  es_dueno_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = accounts_receivable.project_id and p.responsable_id = auth.uid())
)
with check (
  es_dueno_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = accounts_receivable.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "additional_sales_rls" on public.additional_sales;
create policy "additional_sales_rls" on public.additional_sales
for all to authenticated
using (
  exists (select 1 from public.projects p where p.id = additional_sales.project_id and tiene_acceso_empresa(p.empresa_id))
  or exists (select 1 from public.projects p where p.id = additional_sales.project_id and p.responsable_id = auth.uid())
)
with check (
  exists (select 1 from public.projects p where p.id = additional_sales.project_id and tiene_acceso_empresa(p.empresa_id))
  or exists (select 1 from public.projects p where p.id = additional_sales.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "worker_projects_rls" on public.worker_projects;
create policy "worker_projects_rls" on public.worker_projects
for all to authenticated
using (
  tiene_acceso_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = worker_projects.project_id and p.responsable_id = auth.uid())
)
with check (
  tiene_acceso_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = worker_projects.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "documents_rls" on public.documents;
create policy "documents_rls" on public.documents
for all to authenticated
using (
  tiene_acceso_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = documents.project_id and p.responsable_id = auth.uid())
)
with check (
  tiene_acceso_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = documents.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "income_rls" on public.income;
create policy "income_rls" on public.income
for all to authenticated
using (
  es_dueno_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = income.project_id and p.responsable_id = auth.uid())
)
with check (
  es_dueno_empresa(empresa_id)
  or exists (select 1 from public.projects p where p.id = income.project_id and p.responsable_id = auth.uid())
);

drop policy if exists "projects_rls" on public.projects;
create policy "projects_rls" on public.projects
for all to authenticated
using (tiene_acceso_empresa(empresa_id) or responsable_id = auth.uid())
with check (tiene_acceso_empresa(empresa_id) or responsable_id = auth.uid());

drop policy if exists "geolocation_rls" on public.geolocation_logs;
create policy "geolocation_rls" on public.geolocation_logs
for all to authenticated
using (
  exists (select 1 from public.projects p where p.id = geolocation_logs.project_id and es_dueno_empresa(p.empresa_id))
  or usuario_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = geolocation_logs.project_id and p.responsable_id = auth.uid())
)
with check (
  exists (select 1 from public.projects p where p.id = geolocation_logs.project_id and es_dueno_empresa(p.empresa_id))
  or usuario_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = geolocation_logs.project_id and p.responsable_id = auth.uid())
);

-- ---------------------------------------------------------------------
-- 6. Tablas sin ningún control de acceso (hallazgo #6)
-- ---------------------------------------------------------------------
drop policy if exists "clients_rls" on public.clients;
create policy "clients_rls" on public.clients
for all to authenticated
using (tiene_acceso_empresa(empresa_id))
with check (tiene_acceso_empresa(empresa_id));

drop policy if exists "authenticated full access" on public.tasks;
create policy "authenticated full access" on public.tasks
for all to authenticated
using (tiene_acceso_empresa(empresa_id))
with check (tiene_acceso_empresa(empresa_id));

drop policy if exists "authenticated full access" on public.banos_quimicos;
create policy "authenticated full access" on public.banos_quimicos
for all to authenticated
using (tiene_acceso_empresa(empresa_id))
with check (tiene_acceso_empresa(empresa_id));

drop policy if exists "authenticated full access" on public.banos_quimicos_pagos;
create policy "authenticated full access" on public.banos_quimicos_pagos
for all to authenticated
using (exists (select 1 from public.banos_quimicos b where b.id = banos_quimicos_pagos.bano_id and tiene_acceso_empresa(b.empresa_id)))
with check (exists (select 1 from public.banos_quimicos b where b.id = banos_quimicos_pagos.bano_id and tiene_acceso_empresa(b.empresa_id)));

-- ---------------------------------------------------------------------
-- 7. companies / users / user_companies (cierre fino de hallazgo #4)
-- ---------------------------------------------------------------------
drop policy if exists "authenticated puede leer empresas" on public.companies;
create policy "authenticated puede leer empresas" on public.companies
for select to authenticated
using (exists (select 1 from public.user_companies uc where uc.user_id = auth.uid() and uc.empresa_id = companies.id));

drop policy if exists "users_select_rls" on public.users;
create policy "users_select_rls" on public.users
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.user_companies mine
    join public.user_companies theirs on theirs.empresa_id = mine.empresa_id
    where mine.user_id = auth.uid()
      and mine.rol in ('dueno','administrativo')
      and theirs.user_id = users.id
  )
);

drop policy if exists "users_update_rls" on public.users;
create policy "users_update_rls" on public.users
for update to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.user_companies mine
    join public.user_companies theirs on theirs.empresa_id = mine.empresa_id
    where mine.user_id = auth.uid() and mine.rol = 'dueno' and theirs.user_id = users.id
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1 from public.user_companies mine
    join public.user_companies theirs on theirs.empresa_id = mine.empresa_id
    where mine.user_id = auth.uid() and mine.rol = 'dueno' and theirs.user_id = users.id
  )
);

drop policy if exists "users_delete_rls" on public.users;
create policy "users_delete_rls" on public.users
for delete to authenticated
using (
  exists (
    select 1 from public.user_companies mine
    join public.user_companies theirs on theirs.empresa_id = mine.empresa_id
    where mine.user_id = auth.uid() and mine.rol = 'dueno' and theirs.user_id = users.id
  )
);

drop policy if exists "dueno_administrativo_select_user_companies" on public.user_companies;
create policy "dueno_administrativo_select_user_companies" on public.user_companies
for select to authenticated
using (tiene_acceso_empresa(empresa_id));

drop policy if exists "dueno_insert_user_companies" on public.user_companies;
create policy "dueno_insert_user_companies" on public.user_companies
for insert to authenticated
with check (es_dueno_empresa(empresa_id));

-- nuevas: antes no existía forma de cambiar rol/quitar membresía sin
-- borrar el usuario entero (hallazgo #10)
drop policy if exists "dueno_update_user_companies" on public.user_companies;
create policy "dueno_update_user_companies" on public.user_companies
for update to authenticated
using (es_dueno_empresa(empresa_id))
with check (es_dueno_empresa(empresa_id));

drop policy if exists "dueno_delete_user_companies" on public.user_companies;
create policy "dueno_delete_user_companies" on public.user_companies
for delete to authenticated
using (es_dueno_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- 8. RPCs SECURITY DEFINER sin verificación interna — hallazgo NUEVO,
--    más grave que lo reportado originalmente: cualquier autenticado
--    podía borrar cualquier obra/trabajador o auto-asignarse rol dueño.
-- ---------------------------------------------------------------------
create or replace function public.delete_obra(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.projects where id = p_project_id;
  if v_empresa_id is null or not es_dueno_empresa(v_empresa_id) then
    raise exception 'No autorizado';
  end if;
  delete from public.accounts_receivable where project_id = p_project_id;
  delete from public.accounts_payable where project_id = p_project_id;
  delete from public.worker_projects where project_id = p_project_id;
  delete from public.attendance where project_id = p_project_id;
  delete from public.projects where id = p_project_id;
end;
$function$;

create or replace function public.delete_worker(p_worker_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.workers where id = p_worker_id;
  if v_empresa_id is null or not es_dueno_empresa(v_empresa_id) then
    raise exception 'No autorizado';
  end if;
  delete from public.worker_projects where worker_id = p_worker_id;
  delete from public.attendance where worker_id = p_worker_id;
  delete from public.workers where id = p_worker_id;
end;
$function$;

create or replace function public.create_user_profile(user_id uuid, user_email text, user_nombre text, user_rol text, user_avatar text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_dueno() then
    raise exception 'No autorizado';
  end if;
  insert into public.users (id, email, nombre, rol, avatar)
  values (user_id, user_email, user_nombre, user_rol, user_avatar)
  on conflict (id) do update set
    nombre = excluded.nombre,
    rol    = excluded.rol,
    avatar = excluded.avatar;
end;
$function$;

create or replace function public.delete_user(user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.user_companies mine
    join public.user_companies theirs on theirs.empresa_id = mine.empresa_id
    where mine.user_id = auth.uid() and mine.rol = 'dueno' and theirs.user_id = delete_user.user_id
  ) then
    raise exception 'No autorizado';
  end if;
  delete from public.user_companies where user_companies.user_id = delete_user.user_id;
  delete from public.users where id = delete_user.user_id;
  delete from auth.users where id = delete_user.user_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- 9. RPCs legacy sin uso en el código actual (hallazgo #11) — se dejan
--    definidas por si acaso, pero ya no son invocables.
-- ---------------------------------------------------------------------
revoke execute on function public.verify_worker_pin(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_public_workers() from public, anon, authenticated;

commit;
