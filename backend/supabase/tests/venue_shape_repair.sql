-- US18 repair 0019a: a hand-edited venues table (layout and facility stored as lists) is
-- brought back to the migrations' shape. Disposable runner only.
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Recreate the shared project's hand-made shape. 0022's trigger watches venues.layout, so it
-- goes first; the shared project never had it either. The runner replays 0019a, then 0022.
drop trigger if exists venues_sync_primary_layout on public.venues;
alter table public.venues alter column layout type text[] using array[layout];

create or replace function pg_temp.jsonb_keys(value jsonb) returns text[] language sql immutable as $$
  select coalesce(array_agg(key order by key), '{}') from jsonb_object_keys(coalesce(value, '{}')) key
$$;
alter table public.venues alter column facility drop default;
alter table public.venues alter column facility type text[] using pg_temp.jsonb_keys(facility);

insert into public.venues (id, name, location, capacity, layout, facility, status) values
 ('b18a0000-0000-0000-0000-0000000000d1', 'Drifted Ballroom', 'Level 8', 200,
  array['Hall', 'Ballroom'], array['Projector', 'Wi-Fi'], 'active'),
 ('b18a0000-0000-0000-0000-0000000000d2', 'Drifted Store', 'Level 8', 1,
  array[]::text[], array[]::text[], 'active');