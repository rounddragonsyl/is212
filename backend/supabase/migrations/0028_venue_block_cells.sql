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

create or replace function public.block_venue(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure uuid;
begin
  perform public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures (venue_id, starts_on, ends_on, slots, reason, created_by)
  values (p_venue_id, p_starts_on, p_ends_on, p_slots, p_reason, auth.uid())
  returning id into v_closure;

  -- A cell already held (by a booking or another block) makes this insert fail with
  -- 23505, so the whole block is refused. Slice 5 changes that for booked cells.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, d::date, s, 'maintenance', v_closure
  from generate_series(p_starts_on, p_ends_on, interval '1 day') d
  cross join unnest(p_slots) s;

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
