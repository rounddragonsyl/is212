-- US18 Check venue suitability (SCRUM-165), slice 3: capacity per room layout (Q&A #112).
-- venues.layout/capacity stay as each venue's primary layout, because US8 search reads them.
-- Safe to replay.
begin;

-- 'U-Shape', 'u shape' and 'U_SHAPE' must be one layout, or a capacity lookup silently misses.
create or replace function public.layout_code(raw text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(lower(btrim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'), '_'), '')
$$;

create table if not exists public.venue_layouts (
  venue_id uuid not null references public.venues (id) on delete cascade,
  layout   text not null references public.layout_types (code),
  capacity integer not null check (capacity > 0),
  primary key (venue_id, layout)
);

alter table public.venue_layouts enable row level security;
revoke all on public.venue_layouts from anon, authenticated;
grant select, insert, update, delete on public.venue_layouts to authenticated;
drop policy if exists venue_layouts_select_all on public.venue_layouts;
create policy venue_layouts_select_all on public.venue_layouts
  for select to authenticated using (true);
drop policy if exists venue_layouts_manage on public.venue_layouts;
create policy venue_layouts_manage on public.venue_layouts
  for all to authenticated
  using (public.current_user_role() in ('venue_staff', 'operations_manager'))
  with check (public.current_user_role() in ('venue_staff', 'operations_manager'));

-- Keeps each venue's primary layout in venue_layouts, so a venue created through the old
-- columns (including seed data) is never missing from suitability checks. One direction only.
create or replace function public.sync_primary_venue_layout()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text := public.layout_code(new.layout);  -- not "code": that clashes with ON CONFLICT (code)
begin
  if v_code is null then
    return new;
  end if;
  insert into public.layout_types (code, label) values (v_code, btrim(new.layout))
    on conflict (code) do nothing;
  insert into public.venue_layouts (venue_id, layout, capacity) values (new.id, v_code, new.capacity)
    on conflict (venue_id, layout) do update set capacity = excluded.capacity;
  return new;
end;
$$;
revoke execute on function public.sync_primary_venue_layout() from public, anon, authenticated;

drop trigger if exists venues_sync_primary_layout on public.venues;
create trigger venues_sync_primary_layout
  after insert or update of layout, capacity on public.venues
  for each row execute function public.sync_primary_venue_layout();

-- Venues that existed before this migration. DISTINCT ON: 'Theatre' and 'theatre' share a code.
insert into public.layout_types (code, label)
select distinct on (public.layout_code(layout)) public.layout_code(layout), btrim(layout)
from public.venues
where public.layout_code(layout) is not null
on conflict (code) do nothing;

insert into public.venue_layouts (venue_id, layout, capacity)
select id, public.layout_code(layout), capacity
from public.venues
where public.layout_code(layout) is not null
on conflict (venue_id, layout) do nothing;

commit;