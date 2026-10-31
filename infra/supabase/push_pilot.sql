-- Web Push pilot: subscriptions of invited testers and what was last sent to each.
--
-- Nobody reads or writes the tables directly: row level security is on with no
-- policies. The app subscribes through pilot_subscribe (needs the pilot code) and
-- the pipeline reads and updates through the sender_* functions (needs the sender
-- token). Only SHA-256 hashes of both secrets are stored, in push_config, which is
-- filled once from the dashboard and never committed:
--   insert into public.push_config (pilot_code_sha256, sender_token_sha256)
--   values ('<hash>', '<hash>');

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.push_config (
  id boolean primary key default true check (id),
  pilot_code_sha256 text not null,
  sender_token_sha256 text not null
);
alter table public.push_config enable row level security;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  -- Rounded to 2 decimals in the app (~1 km): enough to measure distances, not to find a home.
  lat numeric(5, 2) not null check (lat between -90 and 90),
  lon numeric(5, 2) not null check (lon between -180 and 180),
  radius_km integer not null default 25 check (radius_km in (10, 25, 50)),
  -- Last notification time per kind, so the sender rate-limits and deduplicates.
  last_notified jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.push_subscriptions enable row level security;

create or replace function public.pilot_subscribe(
  code text, endpoint text, p256dh text, auth text, lat numeric, lon numeric, radius_km integer
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from push_config where pilot_code_sha256 = encode(digest(code, 'sha256'), 'hex')
  ) then
    raise exception 'invalid pilot code' using errcode = '28000';
  end if;
  insert into push_subscriptions (endpoint, p256dh, auth, lat, lon, radius_km)
  values (endpoint, p256dh, auth, round(lat, 2), round(lon, 2), radius_km)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat,
        lon = excluded.lon, radius_km = excluded.radius_km, active = true;
end $$;

-- Knowing the endpoint (only the subscribed browser does) is enough to leave.
create or replace function public.pilot_unsubscribe(endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where push_subscriptions.endpoint = pilot_unsubscribe.endpoint;
$$;

create or replace function public.sender_check(token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from push_config where sender_token_sha256 = encode(digest(token, 'sha256'), 'hex')
  ) then
    raise exception 'invalid sender token' using errcode = '28000';
  end if;
end $$;

create or replace function public.sender_list(token text) returns setof public.push_subscriptions
language plpgsql security definer set search_path = public as $$
begin
  perform sender_check(token);
  return query select * from push_subscriptions where active;
end $$;

create or replace function public.sender_mark(token text, sub_id bigint, notified jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sender_check(token);
  update push_subscriptions set last_notified = notified where id = sub_id;
end $$;

-- The push service answered 404/410: the browser dropped the subscription.
create or replace function public.sender_deactivate(token text, sub_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sender_check(token);
  update push_subscriptions set active = false where id = sub_id;
end $$;

revoke all on function public.sender_check(text) from public, anon, authenticated;
revoke all on function public.pilot_subscribe(text, text, text, text, numeric, numeric, integer) from public;
revoke all on function public.pilot_unsubscribe(text) from public;
revoke all on function public.sender_list(text) from public;
revoke all on function public.sender_mark(text, bigint, jsonb) from public;
revoke all on function public.sender_deactivate(text, bigint) from public;
grant execute on function public.pilot_subscribe(text, text, text, text, numeric, numeric, integer) to anon;
grant execute on function public.pilot_unsubscribe(text) to anon;
grant execute on function public.sender_list(text) to anon;
grant execute on function public.sender_mark(text, bigint, jsonb) to anon;
grant execute on function public.sender_deactivate(text, bigint) to anon;
