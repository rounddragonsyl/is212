-- US12 Block Venue Availability (SCRUM-14), slice 3: a saved block holds its cells
-- (SCRUM-119, SCRUM-121). Apply after 0027. Safe to replay.
--
-- A block is a venue_closures row plus one 'maintenance' cell per date and slot in the
-- slot ledger. The ledger's primary key (venue, date, slot) is the hard block: a booking,
-- its setup/turnaround buffer and a block can never share a cell.
begin;

-- A block covers chosen slots, not always whole days. Rows from before this migration
-- were whole-day closures, so the default is all three slots.
alter table public.venue_closures
  add column if not exists slots text[] not null default array['AM', 'PM', 'NIGHT'];

-- Shared by preview (slice 4) and block, so a preview can never accept what the block
-- would refuse. Internal: callable only from the functions below, never the browser.
create or replace function public.venue_block_request_slots(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[]
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can block a venue' using errcode = '42501';
  end if;

  select status into v_status from public.venues where id = p_venue_id;
  if not found then
    raise exception 'That venue could not be found' using errcode = 'P0002';
  end if;
  if v_status = 'retired' then
    raise exception 'A retired venue cannot be blocked' using errcode = '22023';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'A block must end on or after the day it starts' using errcode = '22023';
  end if;
  -- One row per cell is written, so an unbounded range is an unbounded insert.
  -- A longer closure is entered as consecutive blocks.
  if p_ends_on - p_starts_on > 365 then
    raise exception 'A single block can cover at most 366 days' using errcode = '22023';
  end if;

  if cardinality(p_slots) = 0 then
    raise exception 'Choose at least one slot to block' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_slots) s where s not in ('AM', 'PM', 'NIGHT')) then
    raise exception 'Slots must be AM, PM or NIGHT' using errcode = '22023';
  end if;

  -- Each slot once, in time order: NIGHT, AM, AM becomes AM, NIGHT.
  return array(
    select s from (select distinct unnest(p_slots) as s) requested
    order by array_position(array['AM', 'PM', 'NIGHT'], s)
  );
end;
$$;
revoke execute on function public.venue_block_request_slots(uuid, date, date, text[])
  from public, anon, authenticated;

create or replace function public.block_venue(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slots text[];
  v_closure uuid;
begin
  v_slots := public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures (venue_id, starts_on, ends_on, slots, reason, created_by)
  values (p_venue_id, p_starts_on, p_ends_on, v_slots, p_reason, auth.uid())
  returning id into v_closure;

  -- A cell already held (by a booking or another block) makes this insert fail with
  -- 23505, so the whole block is refused. Slice 5 changes that for booked cells.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, d::date, s, 'maintenance', v_closure
  from generate_series(p_starts_on, p_ends_on, interval '1 day') d
  cross join unnest(v_slots) s;

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
