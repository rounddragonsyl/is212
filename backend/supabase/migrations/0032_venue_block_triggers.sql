-- US12 Block Venue Availability (SCRUM-14), slice 6: keep blocks honest after they are
-- saved (SCRUM-123). Apply after 0031. Safe to replay.
begin;

-- A booking inside an active block cannot be approved: the room will not be usable then.
-- Enforced here because this story creates the condition; US10's approve action sees 23514.
-- A booking that was already confirmed when the block landed stays confirmed and flagged.
create or replace function public.refuse_confirming_blocked_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and exists (
       select 1 from public.venue_booking_flags f
       where f.booking_id = new.id and f.status = 'open' and f.cause = 'venue_blocked'
     ) then
    raise exception 'This booking overlaps a venue block and cannot be approved'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.refuse_confirming_blocked_booking()
  from public, anon, authenticated;

drop trigger if exists venue_bookings_refuse_blocked_confirm on public.venue_bookings;
create trigger venue_bookings_refuse_blocked_confirm
  before update of status on public.venue_bookings
  for each row execute function public.refuse_confirming_blocked_booking();

-- When a booking lets go of a cell inside an active block, the block takes it, so a
-- blocked slot never quietly becomes bookable again. Block cells being deleted
-- (kind 'maintenance') are left alone.
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

drop trigger if exists venue_slot_claims_reblock on public.venue_slot_claims;
create trigger venue_slot_claims_reblock
  after delete on public.venue_slot_claims
  for each row execute function public.reblock_released_cell();

commit;
