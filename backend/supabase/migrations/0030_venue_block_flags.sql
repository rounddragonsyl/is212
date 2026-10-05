-- US12 Block Venue Availability (SCRUM-14), slice 5: blocking over bookings flags them
-- (SCRUM-123). Apply after 0029. Safe to replay.
--
-- Week 7 change 2: a booking inside a new block is not cancelled. It keeps its cells; the
-- block takes only the free ones.
begin;

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

  -- Serialise blocks on one venue, so two staff members cannot both pass the overlap check
  -- below and then both save. (A race cannot be shown in the single-session test runner.)
  perform 1 from public.venues where id = p_venue_id for update;

  -- The cell insert below skips held cells, so the ledger key no longer refuses a
  -- same-slot overlap with another block. This check does.
  if exists (
    select 1 from public.venue_closures vc
    where vc.venue_id = p_venue_id
      and vc.starts_on <= p_ends_on and vc.ends_on >= p_starts_on
      and vc.slots && v_slots
  ) then
    raise exception 'Part of this period is already blocked. Remove or change that block first.'
      using errcode = '23505';
  end if;

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures
    (venue_id, starts_on, ends_on, slots, reason, created_by, created_by_name)
  values
    (p_venue_id, p_starts_on, p_ends_on, v_slots, btrim(p_reason), auth.uid(),
     (select full_name from public.profiles where id = auth.uid()))
  returning id into v_closure;

  -- Free cells become blocked. A cell a booking already holds stays with that booking.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, d::date, s, 'maintenance', v_closure
  from generate_series(p_starts_on, p_ends_on, interval '1 day') d
  cross join unnest(v_slots) s
  on conflict (venue_id, slot_date, slot) do nothing;

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
