-- "¿Qué ves ahora?": what people see in the sky, to check the satellite against the ground.
-- Safe to run again: the table is kept and the function is replaced (2026-11-12: "partly").
--
-- Anonymous on purpose: a rounded point (~1 km), what was seen, and what the app was
-- showing at that moment. No account, no device id, no free text. Nobody reads or writes
-- the table directly (row level security on, no policies): the app writes through
-- report_sky and the reports are read from the dashboard.

create table if not exists public.sky_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lat numeric(5, 2) not null,
  lon numeric(5, 2) not null,
  -- Any of: clear, partly, cloudy, rain, heavy_rain, hail, thunder, lightning, wind.
  seen text[] not null,
  -- What the app said when the report was sent, to compare later.
  app_level text,
  app_data_until timestamptz,
  app_nearest_km integer
);
alter table public.sky_reports enable row level security;
create index if not exists sky_reports_created_at on public.sky_reports (created_at);

create or replace function public.report_sky(
  lat numeric, lon numeric, seen text[], app_level text, app_data_until timestamptz, app_nearest_km integer
) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if report_sky.seen is null or cardinality(report_sky.seen) not between 1 and 9
     or not report_sky.seen <@ array['clear', 'partly', 'cloudy', 'rain', 'heavy_rain', 'hail', 'thunder', 'lightning', 'wind'] then
    raise exception 'invalid report' using errcode = '22023';
  end if;
  -- Only the mapped region (status.json observed_bbox, with a margin).
  if report_sky.lat not between -36 and -33 or report_sky.lon not between -73 and -69 then
    raise exception 'outside the region' using errcode = '22023';
  end if;
  if report_sky.app_level is not null
     and report_sky.app_level not in ('quiet', 'deep_convection', 'severe', 'unknown') then
    raise exception 'invalid report' using errcode = '22023';
  end if;
  -- Without accounts, a flood can only be capped as a whole: 120 reports per 10 minutes.
  if (select count(*) from sky_reports where created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'too many reports' using errcode = '53400';
  end if;
  insert into sky_reports (lat, lon, seen, app_level, app_data_until, app_nearest_km)
  values (
    round(report_sky.lat, 2), round(report_sky.lon, 2), report_sky.seen,
    report_sky.app_level, report_sky.app_data_until, report_sky.app_nearest_km
  );
end $$;

revoke all on function public.report_sky(numeric, numeric, text[], text, timestamptz, integer) from public;
grant execute on function public.report_sky(numeric, numeric, text[], text, timestamptz, integer) to anon;
