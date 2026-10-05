-- Repair (US18, SCRUM-165): brings a hand-edited venues table back to the shape the
-- migrations define, before 0020-0023 run on it. The shared project's venues table had been
-- changed by hand: layout and facility became text lists. On any database built from the
-- migrations this file does nothing: each step runs only while a column still has the
-- hand-made type.
--   layout:   text[] -> text, keeping the first listed layout. 0018 defines one primary
--             layout per venue; a venue's other layouts and their capacities live in
--             venue_layouts (0022, Q&A #112). An empty list becomes 'unspecified'.
--   facility: text[] -> jsonb {"code": true}, the shape 0018 defines and both US8 search
--             and US18 suitability read. Names are reduced to letters and digits, which
--             matches the catalogue codes (Wi-Fi -> wifi, Projector -> projector).
-- Numbered 0019a so every replay runs it after 0018 and before 0020. Safe to replay.
begin;

-- ALTER ... USING cannot contain a subquery, so the list-to-object conversion is a function.
create or replace function pg_temp.facility_list_to_jsonb(names text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(code, true), '{}'::jsonb)
  from (
    select distinct nullif(regexp_replace(lower(btrim(name)), '[^a-z0-9]+', '', 'g'), '') as code
    from unnest(coalesce(names, '{}'::text[])) as name
  ) codes
  where code is not null
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues'
      and column_name = 'layout' and data_type = 'ARRAY'
  ) then
    alter table public.venues alter column layout drop default;
    alter table public.venues alter column layout type text
      using coalesce(nullif(btrim(layout[1]), ''), 'unspecified');
    alter table public.venues alter column layout set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues'
      and column_name = 'facility' and data_type = 'ARRAY'
  ) then
    alter table public.venues alter column facility drop default;
    alter table public.venues alter column facility type jsonb
      using pg_temp.facility_list_to_jsonb(facility);
    alter table public.venues alter column facility set default '{}'::jsonb;
  end if;
end $$;

drop function pg_temp.facility_list_to_jsonb(text[]);

commit;