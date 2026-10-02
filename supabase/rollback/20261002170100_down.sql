-- Rollback de 20261002170100_whatsapp_processed_messages.sql
-- No toca pg_cron en sí (otra migración podría necesitarlo) -- solo
-- desprograma el job propio y borra la tabla.
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'whatsapp_processed_messages_cleanup') then
    perform cron.unschedule('whatsapp_processed_messages_cleanup');
  end if;
end $$;

drop table if exists public.whatsapp_processed_messages;

commit;
