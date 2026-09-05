-- Run the private aggregate Instagram collector each day at 13:15 UTC.
-- The request is authenticated with a secret held in Supabase Vault and Edge Function secrets.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'attendaa_project_url') then
    perform vault.create_secret('https://jaixqnjgzsrzegbxfdot.supabase.co', 'attendaa_project_url');
  end if;
end;
$$;

select cron.schedule(
  'attendaa-collect-instagram-insights-daily',
  '15 13 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'attendaa_project_url')
      || '/functions/v1/meta-instagram-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-attendaa-scheduler-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'attendaa_insights_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

;
