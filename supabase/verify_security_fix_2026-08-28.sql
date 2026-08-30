select jsonb_pretty(jsonb_build_object(
  'funciones_nuevas', (
    select jsonb_agg(proname order by proname)
    from pg_proc where pronamespace = 'public'::regnamespace
      and proname in ('tiene_acceso_empresa','es_dueno_empresa')
  ),
  'expenses_policies', (
    select jsonb_agg(policyname order by policyname)
    from pg_policies where schemaname='public' and tablename='expenses'
  ),
  'providers_policies', (
    select jsonb_agg(policyname order by policyname)
    from pg_policies where schemaname='public' and tablename='providers'
  ),
  'delete_obra_ok', (
    select pg_get_functiondef(oid) like '%es_dueno_empresa%'
    from pg_proc where proname='delete_obra' and pronamespace='public'::regnamespace
  ),
  'delete_worker_ok', (
    select pg_get_functiondef(oid) like '%es_dueno_empresa%'
    from pg_proc where proname='delete_worker' and pronamespace='public'::regnamespace
  ),
  'create_user_profile_ok', (
    select pg_get_functiondef(oid) like '%is_dueno%'
    from pg_proc where proname='create_user_profile' and pronamespace='public'::regnamespace
  ),
  'delete_user_ok', (
    select pg_get_functiondef(oid) like '%theirs.user_id%'
    from pg_proc where proname='delete_user' and pronamespace='public'::regnamespace
  ),
  'legacy_grants_revocados', (
    select jsonb_build_object(
      'verify_worker_pin', not exists (
        select 1 from information_schema.role_routine_grants
        where routine_name='verify_worker_pin' and grantee in ('anon','authenticated','PUBLIC')
      ),
      'get_public_workers', not exists (
        select 1 from information_schema.role_routine_grants
        where routine_name='get_public_workers' and grantee in ('anon','authenticated','PUBLIC')
      )
    )
  ),
  'tablas_con_tiene_acceso_empresa', (
    select jsonb_agg(distinct tablename order by tablename)
    from pg_policies
    where schemaname='public' and (qual like '%tiene_acceso_empresa%' or with_check like '%tiene_acceso_empresa%')
  ),
  'user_companies_policies', (
    select jsonb_agg(policyname order by policyname)
    from pg_policies where schemaname='public' and tablename='user_companies'
  )
)) as verificacion;
