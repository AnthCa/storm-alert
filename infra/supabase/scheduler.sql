-- Triggers the "Storm map" GitHub Actions workflow every 10 minutes.
-- GitHub's own `schedule` trigger is best effort and fired only every few hours.
--
-- Prerequisite: a Vault secret named `github_dispatch_token` holding a
-- fine-grained token scoped to AnthCa/storm-alert with Actions: Read and write.
-- Create it from the dashboard (never commit or paste the token anywhere else):
--   select vault.create_secret('<token>', 'github_dispatch_token');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'storm-map-dispatch',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/AnthCa/storm-alert/actions/workflows/storm-map.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'
      ),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'storm-alert-scheduler',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main')
  );
  $$
);

-- Check the last dispatches (204 means GitHub accepted it):
--   select created, status_code, content from net._http_response order by created desc limit 5;
-- Stop the scheduler:
--   select cron.unschedule('storm-map-dispatch');
