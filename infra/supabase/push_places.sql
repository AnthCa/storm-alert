-- Up to three places per subscription ("loved ones": home, a school, the parents' house).
-- Run once after push_pilot.sql; safe to run again.
--
-- Only rounded points (~1 km), a radius and the last notifications per place are stored.
-- The names people give their places never leave the phone: notifications carry the
-- place's slot and the service worker adds the name (app/public/sw.js).
--
-- push_subscriptions.lat/lon/radius_km stay as the first place, so older sender code
-- keeps working; the sender now reads push_places through sender_places.

create table if not exists public.push_places (
  id bigint generated always as identity primary key,
  subscription_id bigint not null references public.push_subscriptions (id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  lat numeric(5, 2) not null check (lat between -90 and 90),
  lon numeric(5, 2) not null check (lon between -180 and 180),
  radius_km integer not null default 25 check (radius_km in (10, 25, 50)),
  -- Last notification time per kind, per place, so the sender rate-limits each place.
  last_notified jsonb not null default '{}'::jsonb,
  unique (subscription_id, slot)
);
alter table public.push_places enable row level security;

-- Existing single-place subscriptions become slot 0.
insert into public.push_places (subscription_id, slot, lat, lon, radius_km, last_notified)
select id, 0, lat, lon, radius_km, last_notified from public.push_subscriptions
on conflict (subscription_id, slot) do nothing;

-- places: [{"lat": .., "lon": .., "radius_km": 10|25|50}, ...], 1 to 3 items, in slot order.
-- A new browser needs the pilot code; one already subscribed proves itself by its endpoint,
-- which only that browser knows (as in pilot_unsubscribe).
create or replace function public.pilot_set_places(
  code text, endpoint text, p256dh text, auth text, places jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
-- Parameters share names with columns: unqualified names in SQL mean the column.
declare
  sub_id bigint;
  first jsonb := places -> 0;
begin
  if jsonb_typeof(places) <> 'array' or jsonb_array_length(places) not between 1 and 3 then
    raise exception 'between 1 and 3 places' using errcode = '22023';
  end if;
  select id into sub_id from push_subscriptions s where s.endpoint = pilot_set_places.endpoint;
  if sub_id is null and not exists (
    select 1 from push_config where pilot_code_sha256 = encode(digest(coalesce(pilot_set_places.code, ''), 'sha256'), 'hex')
  ) then
    raise exception 'invalid pilot code' using errcode = '28000';
  end if;

  insert into push_subscriptions as s (endpoint, p256dh, auth, lat, lon, radius_km)
  values (
    pilot_set_places.endpoint, pilot_set_places.p256dh, pilot_set_places.auth,
    round((first ->> 'lat')::numeric, 2), round((first ->> 'lon')::numeric, 2), (first ->> 'radius_km')::integer
  )
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat,
        lon = excluded.lon, radius_km = excluded.radius_km, active = true
  returning s.id into sub_id;

  -- Upsert by slot so each place keeps its cooldowns when the list is edited.
  insert into push_places as p (subscription_id, slot, lat, lon, radius_km)
  select sub_id, (item.ordinality - 1)::smallint,
         round((item.value ->> 'lat')::numeric, 2), round((item.value ->> 'lon')::numeric, 2),
         (item.value ->> 'radius_km')::integer
  from jsonb_array_elements(places) with ordinality as item
  on conflict (subscription_id, slot) do update
    set lat = excluded.lat, lon = excluded.lon, radius_km = excluded.radius_km;
  delete from push_places p where p.subscription_id = sub_id and p.slot >= jsonb_array_length(places);
end $$;

-- The single-place sign-up of older app versions now writes slot 0 and drops the others.
create or replace function public.pilot_subscribe(
  code text, endpoint text, p256dh text, auth text, lat numeric, lon numeric, radius_km integer
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from push_config where pilot_code_sha256 = encode(digest(pilot_subscribe.code, 'sha256'), 'hex')
  ) then
    raise exception 'invalid pilot code' using errcode = '28000';
  end if;
  perform pilot_set_places(
    pilot_subscribe.code, pilot_subscribe.endpoint, pilot_subscribe.p256dh, pilot_subscribe.auth,
    jsonb_build_array(jsonb_build_object(
      'lat', pilot_subscribe.lat, 'lon', pilot_subscribe.lon, 'radius_km', pilot_subscribe.radius_km
    ))
  );
end $$;

-- One row per place of every active subscription, with what the sender needs.
create or replace function public.sender_places(token text)
returns table (
  place_id bigint, subscription_id bigint, slot smallint, endpoint text, p256dh text, auth text,
  lat numeric, lon numeric, radius_km integer, last_notified jsonb
)
language plpgsql security definer set search_path = public as $$
begin
  perform sender_check(token);
  return query
    select p.id, s.id, p.slot, s.endpoint, s.p256dh, s.auth, p.lat, p.lon, p.radius_km, p.last_notified
    from push_places p join push_subscriptions s on s.id = p.subscription_id
    where s.active
    order by s.id, p.slot;
end $$;

create or replace function public.sender_mark_place(token text, place_id bigint, notified jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sender_check(token);
  update push_places set last_notified = notified where id = place_id;
end $$;

revoke all on function public.pilot_set_places(text, text, text, text, jsonb) from public;
revoke all on function public.sender_places(text) from public;
revoke all on function public.sender_mark_place(text, bigint, jsonb) from public;
grant execute on function public.pilot_set_places(text, text, text, text, jsonb) to anon;
grant execute on function public.sender_places(text) to anon;
grant execute on function public.sender_mark_place(text, bigint, jsonb) to anon;
