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