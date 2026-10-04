-- US18 Check venue suitability (SCRUM-165), slice 1. Safe to replay.
-- 0018 declared venues.accessibility as text, but the app stores and filters it as a list
-- (venueSearchService uses .contains, i.e. @>). Convert it only while it is still text:
-- shared Supabase may already have been corrected by hand.
begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues'
      and column_name = 'accessibility' and data_type = 'text'
  ) then
    alter table public.venues alter column accessibility drop default;
    alter table public.venues alter column accessibility type text[]
      using case
        when accessibility is null or btrim(accessibility) = '' then '{}'::text[]
        when btrim(accessibility) like '{%}' then btrim(accessibility)::text[]
        else array[btrim(accessibility)]
      end;
  end if;
end $$;

update public.venues set accessibility = '{}' where accessibility is null;
alter table public.venues alter column accessibility set default '{}';
alter table public.venues alter column accessibility set not null;

commit;