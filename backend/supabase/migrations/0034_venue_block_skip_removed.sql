-- US12 Block Venue Availability (SCRUM-14), slice 7b: removed blocks no longer count
-- (SCRUM-124). Apply after 0033. Safe to replay.
--
-- 0033 keeps a removed block's row as a record, so everything that looks for active
-- blocks must skip rows with removed_at set: the overlap check, the preview and the
-- re-block trigger.
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
  v_slots      text[];
  v_closure    uuid;
  v_venue_name text;
begin
  v_slots := public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Serialise blocks on one venue, so two staff members cannot both pass the overlap check
  -- below and then both save. (A race cannot be shown in the single-session test runner.)
  select name into v_venue_name from public.venues where id = p_venue_id for update;

  -- The cell insert below skips held cells, so the ledger key no longer refuses a
  -- same-slot overlap with another block. This check does. Removed blocks don't count.
  if exists (
    select 1 from public.venue_closures vc
    where vc.venue_id = p_venue_id
      and vc.removed_at is null
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
  -- The assigned coordinator owns the event; the requester is the fallback for an event
  -- still in the unassigned queue (Week 7 change 5).
  insert into public.venue_booking_flags
    (booking_id, event_id, venue_id, closure_id, cause, detail, affected_cells,
     recipient_id, created_by)
  select b.id, b.event_id, p_venue_id, v_closure, 'venue_blocked',
         'Venue blocked: ' || btrim(p_reason),
         jsonb_agg(jsonb_build_object('date', c.slot_date, 'slot', c.slot, 'kind', c.kind)
                   order by c.slot_date, array_position(array['AM', 'PM', 'NIGHT'], c.slot::text)),
         coalesce(e.coordinator_id, b.requested_by), auth.uid()
  from public.venue_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and c.slot_date between p_starts_on and p_ends_on
    and c.slot = any (v_slots)
    and b.status in ('held', 'pending_approval', 'confirmed')
  group by b.id, b.event_id, e.coordinator_id, b.requested_by;

  -- One email per flag, queued in the same outbox as 0009's review emails.
  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  select f.event_id,
         u.email,
         'Venue booking needs review: ' || v_venue_name,
         format(
           E'Venue Staff have blocked %s from %s to %s (%s).\nReason: %s\n\n'
           'Your booking for event %s (%s) overlaps this period. It has not been cancelled. '
           'Please review it in ConnectSphere and arrange an alternative if needed.',
           v_venue_name, p_starts_on, p_ends_on, array_to_string(v_slots, ', '), btrim(p_reason),
           coalesce(e.reference, 'without a reference'), coalesce(e.name, 'untitled'))
  from public.venue_booking_flags f
  join auth.users u on u.id = f.recipient_id
  join public.events e on e.id = f.event_id
  where f.closure_id = v_closure
    and u.email is not null and btrim(u.email) <> '';

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

create or replace function public.preview_venue_block(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[]
)
returns table (
  overlap_type    text,
  booking_id      uuid,
  booking_status  text,
  event_reference text,
  event_name      text,
  slot_date       date,
  slot            text,
  claim_kind      text,
  block_reason    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slots text[];
begin
  -- The same checks block_venue runs, so a preview never accepts what saving would refuse.
  v_slots := public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  return query
  select 'booking'::text, b.id, b.status::text, e.reference::text, e.name::text,
         c.slot_date, c.slot::text, c.kind::text, null::text
  from public.venue_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and c.slot_date between p_starts_on and p_ends_on
    and c.slot = any (v_slots)
    -- A lapsed hold no longer reserves anything, so it is not an affected booking.
    and not (b.status = 'held' and b.hold_expires_at < now())

  union all

  -- Read from the block rows, not the ledger: a block that lands on a booking does not
  -- own that booking's cell, but it still covers it. Removed blocks don't count.
  select 'existing_block'::text, null::uuid, null::text, null::text, null::text,
         d::date, s::text, 'maintenance'::text, vc.reason::text
  from public.venue_closures vc
  cross join lateral generate_series(greatest(vc.starts_on, p_starts_on),
                                     least(vc.ends_on, p_ends_on), interval '1 day') d
  cross join lateral unnest(vc.slots) s
  where vc.venue_id = p_venue_id
    and vc.removed_at is null
    and vc.starts_on <= p_ends_on and vc.ends_on >= p_starts_on
    and s = any (v_slots)

  order by 6, 7;
end;
$$;
revoke execute on function public.preview_venue_block(uuid, date, date, text[]) from public, anon;
grant execute on function public.preview_venue_block(uuid, date, date, text[]) to authenticated;

-- When a booking lets go of a cell inside an active block, the block takes it, so a
-- blocked slot never quietly becomes bookable again. Block cells being deleted
-- (kind 'maintenance') are left alone, and removed blocks don't take cells back.
create or replace function public.reblock_released_cell()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_covering uuid;
begin
  if old.kind = 'maintenance' then
    return old;
  end if;

  select vc.id into v_covering
  from public.venue_closures vc
  where vc.venue_id = old.venue_id
    and vc.removed_at is null
    and old.slot_date between vc.starts_on and vc.ends_on
    and old.slot = any (vc.slots)
  limit 1;

  if v_covering is not null then
    insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
    values (old.venue_id, old.slot_date, old.slot, 'maintenance', v_covering)
    on conflict (venue_id, slot_date, slot) do nothing;
  end if;
  return old;
end;
$$;
revoke execute on function public.reblock_released_cell()
  from public, anon, authenticated;

commit;
