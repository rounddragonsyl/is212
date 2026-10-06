-- US10 Slice 1, AC10: rejection and slot release must succeed together.
begin;

create or replace function public.release_rejected_venue_booking_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The booking UPDATE remains subject to its existing review policy and reason
  -- constraint. A trigger keeps cleanup in that same transaction; staff cannot
  -- otherwise delete these claims once the booking has become rejected.
  delete from public.venue_slot_claims where booking_id = new.id;
  -- Existing claim-delete triggers retain any covering maintenance block.
  return new;
end;
$$;

revoke execute on function public.release_rejected_venue_booking_claims()
  from public, anon, authenticated;

drop trigger if exists venue_bookings_release_rejected_claims on public.venue_bookings;
create trigger venue_bookings_release_rejected_claims
  after update of status on public.venue_bookings
  for each row
  when (old.status = 'pending_approval' and new.status = 'rejected')
  execute function public.release_rejected_venue_booking_claims();

commit;
