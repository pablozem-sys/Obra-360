-- Rollback de 20261002180100_whatsapp_reminders.sql
-- No toca pg_net en sí (otra migración podría necesitarlo) ni el secreto
-- de Vault (no se creó acá, no se borra acá).
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'enviar_recordatorios_whatsapp') then
    perform cron.unschedule('enviar_recordatorios_whatsapp');
  end if;
end $$;

drop function if exists public.reclamar_recordatorios_pendientes();

drop table if exists public.whatsapp_reminders;

commit;
