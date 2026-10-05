-- US12 Block Venue Availability (SCRUM-14). Disposable runner only: synthetic users, real RLS.
-- Fixtures use the b12a prefix so they never collide with other stories' rows.
--
-- Slices 1 and 2 are independent refusals, listed in ID order. From slice 3 on, tests
-- build on earlier state (a saved block, a flagged booking), so each slice adds a new
-- section at the end in the order things happen.

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as owner)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b12a0000-0000-0000-0000-000000000001', 'venue12@example.test', '{"full_name":"Vera Venue"}');
update public.profiles set role = 'venue_staff'
 where id = 'b12a0000-0000-0000-0000-000000000001';

insert into public.venues (id, name, location, capacity, layout, status) values
 ('b12a0000-0000-0000-0000-0000000000f1', 'Blocks Hall',  'Level 1', 200, 'Theatre',   'active'),
 ('b12a0000-0000-0000-0000-0000000000f2', 'Retired Room', 'Level 2',  40, 'Boardroom', 'retired');

-- An existing block, for the direct update and delete checks.
insert into public.venue_closures (id, venue_id, starts_on, ends_on, reason, created_by) values
 ('b12a0000-0000-0000-0000-0000000000c1', 'b12a0000-0000-0000-0000-0000000000f1',
  '2040-06-01', '2040-06-01', 'Fixture block', 'b12a0000-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;

set role authenticated;

-- ===== AC-012.1 Only Venue Staff can block, and only through block_venue =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'Coordinator attempt')$q$, '42501',
  'AC-012.1.1: a coordinator cannot block a venue');

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'Organiser attempt')$q$, '42501',
  'AC-012.1.2: an organiser cannot block a venue');

select pg_temp.as_user('');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'No session')$q$, '42501',
  'AC-012.1.3: a request without a signed-in user cannot block a venue');

-- Venue Staff themselves cannot skip block_venue by writing rows directly. The direct
-- insert uses a different date from the fixture block, so 0018's overlap rule can't be
-- what refuses it.
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.venue_closures (venue_id, starts_on, ends_on, reason, created_by)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-05-01','2040-05-01','Direct insert',
          'b12a0000-0000-0000-0000-000000000001')$q$, '42501',
  'AC-012.1.4: venue staff cannot create a block row directly');
select pg_temp.expect_error($q$insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-06-01','AM','maintenance',
          'b12a0000-0000-0000-0000-0000000000c1')$q$, '42501',
  'AC-012.1.5: venue staff cannot write a blocked cell directly');
select pg_temp.expect_error($q$delete from public.venue_closures
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.6: venue staff cannot delete a block row directly');
select pg_temp.expect_error($q$update public.venue_closures set reason = 'Edited directly'
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.7: venue staff cannot change a block row directly');

-- ===== AC-012.2 One or more slots, on one date or a range: what is refused =====
-- Still as Venue Staff. Each request is valid except for the one field under test.
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['EVENING'],'Bad slot')$q$, '22023',
  'AC-012.2.3: an unknown slot code is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array[]::text[],'No slots')$q$, '22023',
  'AC-012.2.4: a block with no slots is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-02','2040-05-01',array['AM'],'Backwards')$q$, '22023',
  'AC-012.2.5: a block ending before it starts is refused');
-- 1 May 2040 to 2 May 2041 is 367 days, one over the limit.
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2041-05-02',array['AM'],'Too long')$q$, '22023',
  'AC-012.2.6: a single block longer than 366 days is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f2',
  '2040-05-01','2040-05-01',array['AM'],'Retired')$q$, '22023',
  'AC-012.2.9: a retired venue cannot be blocked');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000ff',
  '2040-05-01','2040-05-01',array['AM'],'Missing venue')$q$, 'P0002',
  'AC-012.2.10: an unknown venue is reported as not found');

-- ===== AC-012.3 A reason is required =====
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'   ')$q$, '22023',
  'AC-012.3.1: a blank reason is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],null)$q$, '22023',
  'AC-012.3.2: a missing reason is refused');

-- ===== Slice 3: a saved block, and its cells in the slot ledger =====
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-01', '2040-04-01',
  array['PM'], 'Deep clean');
select pg_temp.assert_true(
  exists (select 1 from public.venue_closures
          where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
            and starts_on = '2040-04-01' and ends_on = '2040-04-01'
            and slots = array['PM'] and reason = 'Deep clean'),
  'AC-012.2.1: blocking one slot on one date saves a block for that date and slot');
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b12a0000-0000-0000-0000-0000000000e' || n)::uuid,
       '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
       'Block fixture', 'Block event ' || n, 'EVT-B12-' || n,
       '2040-01-01 01:00+00', '2040-01-01 02:00+00', 50, 'approved'
from generate_series(1, 5) n;

-- Places a booking the way holdVenue does. cells: [{"date":..,"slot":..,"kind":..}]
create or replace function pg_temp.hold(booking uuid, venue uuid, event uuid, cells jsonb)
returns void language sql as $$
  insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
  values (booking, event, venue, auth.uid(), 'held', now() + interval '2 days');
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
  select venue, (c->>'date')::date, c->>'slot', c->>'kind', booking
  from jsonb_array_elements(cells) c;
$$;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
-- 1 Apr PM is blocked (Deep clean), so an event in that slot must be refused.
select pg_temp.expect_error($q$select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b1',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e1',
  '[{"date":"2040-04-01","slot":"AM","kind":"buffer"},{"date":"2040-04-01","slot":"PM","kind":"event"},
    {"date":"2040-04-01","slot":"NIGHT","kind":"buffer"}]')$q$, '23505',
  'AC-012.5.1: a booking whose event slot is blocked is refused');
