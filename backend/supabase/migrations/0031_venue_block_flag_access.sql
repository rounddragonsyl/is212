-- US12 Block Venue Availability (SCRUM-14), slice 5b: who can read which booking flag
-- (SCRUM-123). Apply after 0030. Safe to replay.
--
-- Read only. Nobody writes flags from the browser: they are raised by block_venue() and
-- resolved by the database itself.
begin;

grant select on public.venue_booking_flags to authenticated;

-- Venue Staff see every flag, so they can follow up on the bookings their blocks affect.
drop policy if exists venue_booking_flags_select_staff on public.venue_booking_flags;
create policy venue_booking_flags_select_staff on public.venue_booking_flags
  for select to authenticated
  using (public.current_user_role() = 'venue_staff');

-- A coordinator sees flags on the events assigned to them now, so a reassigned event's
-- open problem moves to the new coordinator.
drop policy if exists venue_booking_flags_select_coordinator on public.venue_booking_flags;
create policy venue_booking_flags_select_coordinator on public.venue_booking_flags
  for select to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and exists (
      select 1 from public.events e
      where e.id = venue_booking_flags.event_id and e.coordinator_id = auth.uid()
    )
  );

commit;
