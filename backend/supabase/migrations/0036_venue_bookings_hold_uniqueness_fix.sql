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

commit;
