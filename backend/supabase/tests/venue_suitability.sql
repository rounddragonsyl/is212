-- US18 Check venue suitability. Disposable runner only: synthetic data, real RLS.
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b18a0000-0000-0000-0000-000000000001', 'venue18@example.test', '{"full_name":"Suitability Venue Staff"}');
update public.profiles set role = 'venue_staff' where id = 'b18a0000-0000-0000-0000-000000000001';

insert into public.venues (id, name, location, capacity, layout, accessibility) values
 ('b18a0000-0000-0000-0000-0000000000f1', 'Layout Hall', 'Level 4', 30, 'Theatre',
  '{wheelchair_access,hearing_loop}');

select pg_temp.assert_true(
  (select count(*) = 1 from public.venues
   where id = 'b18a0000-0000-0000-0000-0000000000f1'
     and accessibility @> array['wheelchair_access']),
  'AC-018.3.1: venue accessibility features are stored as a list that can be matched');


  insert into public.venues (id, name, location, capacity, layout) values
 ('b18a0000-0000-0000-0000-0000000000f2', 'Plain Room', 'Level 5', 12, 'Boardroom');
select pg_temp.assert_true(
  (select accessibility = '{}' from public.venues where id = 'b18a0000-0000-0000-0000-0000000000f2'),
  'AC-018.3.2: a venue saved without accessibility features has an empty list');
select pg_temp.expect_error($q$update public.venues set accessibility = null
  where id = 'b18a0000-0000-0000-0000-0000000000f2'$q$, '23502',
  'AC-018.3.3: accessibility cannot be left empty as null');

-- ===== Layout catalogue =====
select pg_temp.assert_true(
  (select array_agg(code order by sort_order)
   = array['theatre','classroom','boardroom','u_shape','banquet','cabaret','reception']
   from public.layout_types),
  'AC-018.3.5: the layout catalogue lists the seven standard layouts in display order');
select pg_temp.expect_error($q$insert into public.layout_types (code, label) values ('U-Shape', 'Bad code')$q$,
  '23514', 'AC-018.3.6: a layout code must be lowercase letters, digits and underscores');
select pg_temp.expect_error($q$insert into public.layout_types (code, label) values ('blank_label', '   ')$q$,
  '23514', 'AC-018.3.7: a layout must have a name');

create or replace function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');  -- a coordinator
select pg_temp.assert_true(exists (select 1 from public.layout_types where code = 'theatre'),
  'AC-018.3.8: a signed-in user can read the layout catalogue');
select pg_temp.expect_error($q$insert into public.layout_types (code, label) values ('stage', 'Stage')$q$,
  '42501', 'AC-018.3.9: the layout catalogue cannot be changed from the browser');
reset role;


-- ===== Capacity per layout =====
select pg_temp.assert_true(
  public.layout_code('U-Shape') = 'u_shape' and public.layout_code('  u shape ') = 'u_shape'
  and public.layout_code('U_SHAPE') = 'u_shape' and public.layout_code('   ') is null
  and public.layout_code(null) is null,
  'AC-018.3.11: differently written names for one layout resolve to the same code');
set role authenticated;
select pg_temp.as_user('b18a0000-0000-0000-0000-000000000001');  -- venue staff
insert into public.venue_layouts (venue_id, layout, capacity)
values ('b18a0000-0000-0000-0000-0000000000f1', 'classroom', 50);
select pg_temp.assert_true(
  exists (select 1 from public.venue_layouts
          where venue_id = 'b18a0000-0000-0000-0000-0000000000f1' and layout = 'classroom' and capacity = 50),
  'AC-018.3.12: venue staff can record a capacity for a layout');
select pg_temp.expect_error($q$insert into public.venue_layouts (venue_id, layout, capacity)
  values ('b18a0000-0000-0000-0000-0000000000f1','banquet',0)$q$, '23514',
  'AC-018.3.13: a layout capacity of zero is refused');
select pg_temp.expect_error($q$insert into public.venue_layouts (venue_id, layout, capacity)
  values ('b18a0000-0000-0000-0000-0000000000f1','not_a_layout',10)$q$, '23503',
  'AC-018.3.14: a capacity can only be for a catalogue layout');
reset role;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');  -- coordinator
select pg_temp.assert_true(
  exists (select 1 from public.venue_layouts where venue_id = 'b18a0000-0000-0000-0000-0000000000f1'),
  'AC-018.3.15: a coordinator can read venue layout capacities');
select pg_temp.expect_error($q$insert into public.venue_layouts (venue_id, layout, capacity)
  values ('b18a0000-0000-0000-0000-0000000000f1','banquet',20)$q$, '42501',
  'AC-018.3.16: a coordinator cannot change venue layout capacities');
reset role;

create temp table venues_before_replay as select * from public.venues;
create temp table layout_types_before_replay as select * from public.layout_types;