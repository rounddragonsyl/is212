-- US18 Check venue suitability. Disposable runner only: synthetic data, real RLS.
reset role;
select set_config('request.jwt.claim.sub', '', false);

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


create temp table venues_before_replay as select * from public.venues;