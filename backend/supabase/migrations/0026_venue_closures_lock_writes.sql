-- US12 Block Venue Availability (SCRUM-14), slice 1: lock direct writes (SCRUM-120).
-- Apply after 0025. Safe to replay.
--
-- Blocks will change only through the US12 functions added in later slices, which also
-- flag overlapping bookings and notify their coordinators. A direct write would skip
-- both, so the browser loses write access to venue_closures and to maintenance cells.
-- Reading is unchanged.
begin;

drop policy if exists closures_insert_manage on public.venue_closures;
revoke insert on public.venue_closures from anon, authenticated;

-- Only the policy goes: coordinators still insert event and buffer cells (holdVenue).
drop policy if exists claims_insert_maintenance on public.venue_slot_claims;

commit;
