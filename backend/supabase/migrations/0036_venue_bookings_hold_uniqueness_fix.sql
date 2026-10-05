-- Fixes 0026: venue_bookings_one_live_per_event wrongly counted 'confirmed' bookings.
-- US14's equipment fixtures confirm a multi-venue event legitimately needs two simultaneous
-- confirmed venue_bookings rows (e.g. HALL + ANNEX, AC-014.5.3). The tentative-hold AC only
-- asks for at most one active *hold* (held/pending_approval) per event at a time, not a
-- single confirmed venue overall. Apply after 0026. Safe to replay.
begin;

drop index if exists venue_bookings_one_live_per_event;

create unique index if not exists venue_bookings_one_active_hold_per_event
  on public.venue_bookings (event_id)
  where (status in ('held', 'pending_approval'));

drop policy if exists bookings_insert_coordinator on public.venue_bookings;
create policy bookings_insert_coordinator on public.venue_bookings
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status = 'held'
    and exists (
      select 1 from public.events e
      where e.id = venue_bookings.event_id
        and (e.coordinator_id = auth.uid() or e.coordinator_id is null)
        and e.status in ('approved', 'planning')
    )
  );
  
commit;
