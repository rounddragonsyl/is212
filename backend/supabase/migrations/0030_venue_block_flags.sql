-- US12 Block Venue Availability (SCRUM-14), slice 5: blocking over bookings flags them
-- (SCRUM-123). Apply after 0029. Safe to replay.
--
-- Week 7 change 2: a booking inside a new block is not cancelled. It keeps its cells and is
-- flagged for review; the block takes only the free cells.
begin;

-- "This booking needs review." Generic so US46, US47 and US48 can reuse it for other
-- causes; this story only writes 'venue_blocked'. Closed to the browser for now: who may
-- read which flag is the next slice.
create table if not exists public.venue_booking_flags (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.venue_bookings (id) on delete cascade,
  event_id       uuid not null references public.events (id) on delete cascade,
  venue_id       uuid not null references public.venues (id),
  closure_id     uuid references public.venue_closures (id),
  cause          text not null check (cause in
                   ('venue_blocked', 'venue_retired', 'venue_details_changed', 'setup_turnaround_changed')),
  detail         text not null check (length(btrim(detail)) > 0),
  affected_cells jsonb not null default '[]'::jsonb,
  recipient_id   uuid references public.profiles (id),
  status         text not null default 'open' check (status in ('open', 'resolved')),
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  unique (booking_id, closure_id)
);
alter table public.venue_booking_flags enable row level security;
revoke all on public.venue_booking_flags from anon, authenticated;

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

  -- Lapsed holds are otherwise released only when someone next books (0018). Release this
  -- venue's now, so a dead hold is neither flagged nor left on a cell the block should own.
  delete from public.venue_slot_claims c
  using public.venue_bookings b
  where c.booking_id = b.id and b.venue_id = p_venue_id
    and b.status = 'held' and b.hold_expires_at < now();
  update public.venue_bookings
  set status = 'expired'
  where venue_id = p_venue_id and status = 'held' and hold_expires_at < now();

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

  -- One flag per live booking inside the block, listing only its cells that the block covers.
  insert into public.venue_booking_flags
    (booking_id, event_id, venue_id, closure_id, cause, detail, affected_cells,
     recipient_id, created_by)
  select b.id, b.event_id, p_venue_id, v_closure, 'venue_blocked',
         'Venue blocked: ' || btrim(p_reason),
         jsonb_agg(jsonb_build_object('date', c.slot_date, 'slot', c.slot, 'kind', c.kind)
                   order by c.slot_date, array_position(array['AM', 'PM', 'NIGHT'], c.slot::text)),
         e.coordinator_id, auth.uid()
  from public.venue_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and c.slot_date between p_starts_on and p_ends_on
    and c.slot = any (v_slots)
    and b.status in ('held', 'pending_approval', 'confirmed')
  group by b.id, b.event_id, e.coordinator_id;

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
