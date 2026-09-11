-- Install only after the reviewed migrations, deployment, and Vault setup.
-- This job runs independently of an open browser. Never put secret literals here.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $install$
DECLARE
  endpoint text;
  bearer_secret text;
  previous_job record;
BEGIN
  SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets
    WHERE name = 'personal_calendar_reminder_url';
  SELECT decrypted_secret INTO bearer_secret FROM vault.decrypted_secrets
    WHERE name = 'personal_calendar_reminder_secret';
  IF endpoint IS NULL OR endpoint !~ '^https://[^[:space:]]+/api/scheduled/reminder$'
     OR bearer_secret IS NULL OR length(trim(bearer_secret)) = 0 THEN
    RAISE EXCEPTION 'Configure the HTTPS reminder endpoint and bearer secret in Vault before installing the scheduler.';
  END IF;
  FOR previous_job IN SELECT jobid FROM cron.job WHERE jobname = 'personal-calendar-reminder-sweep' LOOP
    PERFORM cron.unschedule(previous_job.jobid);
  END LOOP;
  PERFORM cron.schedule('personal-calendar-reminder-sweep', '*/5 * * * *', $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'personal_calendar_reminder_url'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'personal_calendar_reminder_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$);
END
$install$;
COMMIT;
