-- US18 Check venue suitability (SCRUM-165), slice 2: the catalogue of room layouts.
-- The customer never listed layout types, so this seed is a team assumption.
-- A table, not an enum: Venue Staff can add a layout without a code change. Safe to replay.
begin;

create table if not exists public.layout_types (
  code       text primary key check (code ~ '^[a-z0-9_]+$'),
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 100
);

insert into public.layout_types (code, label, sort_order) values
  ('theatre',   'Theatre',              1),
  ('classroom', 'Classroom',            2),
  ('boardroom', 'Boardroom',            3),
  ('u_shape',   'U-shape',              4),
  ('banquet',   'Banquet (rounds)',     5),
  ('cabaret',   'Cabaret',              6),
  ('reception', 'Reception (standing)', 7)
on conflict (code) do nothing;

alter table public.layout_types enable row level security;
revoke all on public.layout_types from anon, authenticated;
grant select on public.layout_types to authenticated;
drop policy if exists layout_types_select_all on public.layout_types;
create policy layout_types_select_all on public.layout_types
  for select to authenticated using (true);

commit;