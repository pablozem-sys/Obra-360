-- =====================================================================
-- Fixes del Security Advisor de Supabase (2026-10-13). Los 2 ERROR reales:
--
-- 1. worker_kiosk_sessions sin RLS: anon podía leer todos los tokens de
--    kiosco vigentes (y con eso marcar entrada/salida como cualquier
--    trabajador) o insertarse sesiones. Solo la tocan las RPC SECURITY
--    DEFINER del kiosco (corren como owner y sortean RLS), así que se
--    habilita RLS sin policies y se quitan los grants directos.
--
-- 2. app_errors_resumen / asistente_uso_resumen eran vistas SECURITY
--    DEFINER: ignoraban la allowlist de email de las tablas base, así que
--    cualquiera (incluso anon) podía leerlas. Con security_invoker la RLS
--    de la tabla base aplica y /monitoreo sigue viéndose igual para admin.
-- =====================================================================
begin;

alter table public.worker_kiosk_sessions enable row level security;
revoke all on public.worker_kiosk_sessions from anon, authenticated;

alter view public.app_errors_resumen set (security_invoker = true);
alter view public.asistente_uso_resumen set (security_invoker = true);
revoke all on public.app_errors_resumen from anon;
revoke all on public.asistente_uso_resumen from anon;
revoke insert, update, delete, truncate, references, trigger on public.app_errors_resumen from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.asistente_uso_resumen from authenticated;

commit;
