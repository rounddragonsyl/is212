-- US12 Block Venue Availability (SCRUM-14). Disposable runner only: synthetic users, real RLS.
-- Fixtures use the b12a prefix so they never collide with other stories' rows.
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b12a0000-0000-0000-0000-000000000001', 'venue12@example.test', '{"full_name":"Vera Venue"}');
update public.profiles set role = 'venue_staff'
 where id = 'b12a0000-0000-0000-0000-000000000001';

insert into public.venues (id, name, location, capacity, layout, status) values
 ('b12a0000-0000-0000-0000-0000000000f1', 'Blocks Hall', 'Level 1', 200, 'Theatre', 'active');

-- An existing block, inserted as owner, for the update and delete checks.
insert into public.venue_closures (id, venue_id, starts_on, ends_on, reason, created_by) values
 ('b12a0000-0000-0000-0000-0000000000c1', 'b12a0000-0000-0000-0000-0000000000f1',
  '2040-06-01', '2040-06-01', 'Fixture block', 'b12a0000-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;

set role authenticated;
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');

-- ===== AC-012.1 Only Venue Staff can block, and only through the block functions =====
select pg_temp.expect_error($q$insert into public.venue_closures (venue_id, starts_on, ends_on, reason, created_by)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-05-01','2040-05-01','Direct insert',
          'b12a0000-0000-0000-0000-000000000001')$q$, '42501',
  'AC-012.1.4: venue staff cannot create a block row directly');select pg_temp.expect_error($q$insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-06-01','AM','maintenance',
          'b12a0000-0000-0000-0000-0000000000c1')$q$, '42501',
  'AC-012.1.5: venue staff cannot write a blocked cell directly');
select pg_temp.expect_error($q$delete from public.venue_closures
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.6: venue staff cannot delete a block row directly');
select pg_temp.expect_error($q$update public.venue_closures set reason = 'Edited directly'
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.7: venue staff cannot change a block row directly');

-- ===== AC-012.1 (cont.) Only Venue Staff can call block_venue =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'Coordinator attempt')$q$, '42501',
  'AC-012.1.1: a coordinator cannot block a venue');
