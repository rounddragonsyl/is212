-- Equipment catalogue, units, coordinator requests, tech support reservations and defects.
-- Apply after 0011 (references public.venues). Coordinators only ever see types, and the
-- outcome of their own requests; units, allocations and stock are tech support only.
-- "if not exists" leaves an existing table untouched, so drop older drafts first.
begin;

create extension if not exists btree_gist;

create table if not exists public.venue_distances (
  venue_a        uuid not null references public.venues (id) on delete cascade,
  venue_b        uuid not null references public.venues (id) on delete cascade,
  distance_m     integer not null check (distance_m >= 0),
  travel_minutes integer not null check (travel_minutes >= 0),
  primary key (venue_a, venue_b),
  check (venue_a < venue_b)
);

create table if not exists public.equipment_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   text not null,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_items (
  id                 uuid primary key default gen_random_uuid(),
  type_id            uuid not null references public.equipment_types (id),
  asset_tag          text not null unique,
  home_venue_id      uuid not null references public.venues (id),
  current_venue_id   uuid not null references public.venues (id),
  condition          text not null default 'good'
    check (condition in ('new', 'good', 'fair', 'poor')),
  operational_status text not null default 'operational'
    check (operational_status in ('operational', 'needs_repair', 'under_repair', 'retired', 'missing')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, type_id)
);
create index if not exists equipment_items_type_status_idx
  on public.equipment_items (type_id, operational_status);

create table if not exists public.equipment_bookings (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id),
  requested_by        uuid not null references public.profiles (id),
  deliver_to_venue_id uuid not null references public.venues (id),
  use_from            date not null,
  use_to              date not null check (use_to >= use_from),
  return_buffer_days  integer not null default 1 check (return_buffer_days >= 0),
  status              text not null default 'submitted'
    check (status in ('submitted', 'awaiting_coordinator', 'confirmed',
                      'partially_confirmed', 'rejected', 'cancelled', 'completed')),
  reviewed_by         uuid references public.profiles (id),
  reviewed_at         timestamptz,
  review_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists equipment_bookings_event_id_idx on public.equipment_bookings (event_id);

create table if not exists public.equipment_booking_lines (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references public.equipment_bookings (id) on delete cascade,
  type_id              uuid not null references public.equipment_types (id),
  origin               text not null default 'requested' check (origin in ('requested', 'suggested')),
  substitutes_line_id  uuid references public.equipment_booking_lines (id),
  quantity_requested   integer not null check (quantity_requested > 0),
  quantity_reserved    integer not null default 0,
  status               text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'partially_fulfilled', 'unavailable', 'proposed', 'declined')),
  assessment_note      text,
  assessed_by          uuid references public.profiles (id),
  assessed_at          timestamptz,
  unique (id, type_id),
  check (quantity_reserved <= quantity_requested),
  check ((origin = 'suggested') = (substitutes_line_id is not null)),
  check (origin = 'suggested' or status not in ('proposed', 'declined'))
);
create index if not exists equipment_booking_lines_booking_id_idx
  on public.equipment_booking_lines (booking_id);

create table if not exists public.equipment_allocations (
  id          uuid primary key default gen_random_uuid(),
  line_id     uuid not null,
  item_id     uuid not null,
  type_id     uuid not null,
  blocked_from date not null,
  blocked_to   date not null check (blocked_to >= blocked_from),
  status      text not null default 'reserved'
    check (status in ('reserved', 'checked_out', 'returned', 'cancelled')),
  returned_at timestamptz,
  reserved_by uuid not null references public.profiles (id),
  foreign key (line_id, type_id)
    references public.equipment_booking_lines (id, type_id) on delete cascade,
  foreign key (item_id, type_id) references public.equipment_items (id, type_id),
  constraint no_double_allocation
    exclude using gist (item_id with =, daterange(blocked_from, blocked_to, '[]') with &&)
    where (status <> 'cancelled')
);
create index if not exists equipment_allocations_line_id_idx on public.equipment_allocations (line_id);

create table if not exists public.equipment_defect_reports (
  id                   uuid primary key default gen_random_uuid(),
  item_id              uuid not null references public.equipment_items (id),
  allocation_id        uuid references public.equipment_allocations (id),
  reported_by          uuid not null references public.profiles (id),
  kind                 text not null check (kind in ('defect', 'damage', 'missing', 'other')),
  description          text not null,
  resulting_condition  text check (resulting_condition in ('new', 'good', 'fair', 'poor')),
  resulting_status     text not null
    check (resulting_status in ('operational', 'needs_repair', 'under_repair', 'retired', 'missing')),
  reported_at          timestamptz not null default now()
);

-- Keeps quantity_reserved true without giving coordinators any access to allocations.
create or replace function public.sync_line_reserved() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_line uuid := coalesce(new.line_id, old.line_id);
begin
  update public.equipment_booking_lines
     set quantity_reserved = (select count(*) from public.equipment_allocations
                              where line_id = v_line and status <> 'cancelled')
   where id = v_line;
  return null;
end $$;
revoke execute on function public.sync_line_reserved() from public, anon, authenticated;

drop trigger if exists equipment_allocations_sync_line on public.equipment_allocations;
create trigger equipment_allocations_sync_line
  after insert or update of status or delete on public.equipment_allocations
  for each row execute function public.sync_line_reserved();

create or replace view public.equipment_stock with (security_invoker = true) as
select t.id as type_id, t.name, t.category,
       count(i.id) as total_units,
       count(i.id) filter (where i.operational_status = 'operational') as operational_units
from public.equipment_types t
left join public.equipment_items i on i.type_id = t.id
group by t.id, t.name, t.category;

drop trigger if exists equipment_items_set_updated_at on public.equipment_items;
create trigger equipment_items_set_updated_at
  before update on public.equipment_items
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_bookings_set_updated_at on public.equipment_bookings;
create trigger equipment_bookings_set_updated_at
  before update on public.equipment_bookings
  for each row execute function public.set_updated_at();

alter table public.venue_distances enable row level security;
alter table public.equipment_types enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_bookings enable row level security;
alter table public.equipment_booking_lines enable row level security;
alter table public.equipment_allocations enable row level security;
alter table public.equipment_defect_reports enable row level security;

grant select, insert, update, delete on
  public.venue_distances, public.equipment_types, public.equipment_items,
  public.equipment_bookings, public.equipment_booking_lines,
  public.equipment_allocations, public.equipment_defect_reports
  to authenticated;
grant select on public.equipment_stock to authenticated;

-- venue_distances
drop policy if exists distances_select_staff on public.venue_distances;
create policy distances_select_staff on public.venue_distances
  for select to authenticated
  using (public.current_user_role() in
    ('coordinator', 'venue_staff', 'tech_support'));

drop policy if exists distances_manage_insert on public.venue_distances;
create policy distances_manage_insert on public.venue_distances
  for insert to authenticated
  with check (public.current_user_role() in ('venue_staff'));

drop policy if exists distances_manage_update on public.venue_distances;
create policy distances_manage_update on public.venue_distances
  for update to authenticated
  using (public.current_user_role() in ('venue_staff'))
  with check (public.current_user_role() in ('venue_staff'));

-- equipment_types: coordinators read the catalogue to choose from; tech support manages it.
drop policy if exists types_select_staff on public.equipment_types;
create policy types_select_staff on public.equipment_types
  for select to authenticated
  using (public.current_user_role() in ('coordinator', 'tech_support'));

drop policy if exists types_manage_insert on public.equipment_types;
create policy types_manage_insert on public.equipment_types
  for insert to authenticated
  with check (public.current_user_role() = 'tech_support');

drop policy if exists types_manage_update on public.equipment_types;
create policy types_manage_update on public.equipment_types
  for update to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support');

-- Units, allocations and defect reports: tech support only. Coordinators get no policy,
-- so they cannot see stock, quantities or which units exist.
drop policy if exists items_tech_support on public.equipment_items;
create policy items_tech_support on public.equipment_items
  for all to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support');

drop policy if exists allocations_tech_support on public.equipment_allocations;
create policy allocations_tech_support on public.equipment_allocations
  for all to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support' and reserved_by = auth.uid());

drop policy if exists defects_tech_support on public.equipment_defect_reports;
create policy defects_tech_support on public.equipment_defect_reports
  for all to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support' and reported_by = auth.uid());

-- equipment_bookings
drop policy if exists eq_bookings_select on public.equipment_bookings;
create policy eq_bookings_select on public.equipment_bookings
  for select to authenticated
  using (
    public.current_user_role() in ('tech_support', 'operations_manager')
    or requested_by = auth.uid()
  );

drop policy if exists eq_bookings_insert_coordinator on public.equipment_bookings;
create policy eq_bookings_insert_coordinator on public.equipment_bookings
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status = 'submitted'
  );

drop policy if exists eq_bookings_cancel_coordinator on public.equipment_bookings;
create policy eq_bookings_cancel_coordinator on public.equipment_bookings
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status in ('submitted', 'awaiting_coordinator')
  )
  with check (requested_by = auth.uid() and status = 'cancelled');

drop policy if exists eq_bookings_review_tech_support on public.equipment_bookings;
create policy eq_bookings_review_tech_support on public.equipment_bookings
  for update to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support');

-- equipment_booking_lines
drop policy if exists eq_lines_select on public.equipment_booking_lines;
create policy eq_lines_select on public.equipment_booking_lines
  for select to authenticated
  using (
    public.current_user_role() in ('tech_support', 'operations_manager')
    or exists (
      select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id and b.requested_by = auth.uid()
    )
  );

-- A coordinator can only add plain requests to their own new booking. They cannot set
-- outcomes, reservation counts or suggestions.
drop policy if exists eq_lines_insert_coordinator on public.equipment_booking_lines;
create policy eq_lines_insert_coordinator on public.equipment_booking_lines
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and origin = 'requested' and status = 'pending'
    and quantity_reserved = 0 and assessed_by is null
    and exists (
      select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id
        and b.requested_by = auth.uid() and b.status = 'submitted'
    )
  );

-- A coordinator answers a suggested alternative: accept (pending) or decline.
drop policy if exists eq_lines_respond_coordinator on public.equipment_booking_lines;
create policy eq_lines_respond_coordinator on public.equipment_booking_lines
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and origin = 'suggested' and status = 'proposed'
    and exists (
      select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id and b.requested_by = auth.uid()
    )
  )
  with check (origin = 'suggested' and status in ('pending', 'declined'));

drop policy if exists eq_lines_tech_support on public.equipment_booking_lines;
create policy eq_lines_tech_support on public.equipment_booking_lines
  for all to authenticated
  using (public.current_user_role() = 'tech_support')
  with check (public.current_user_role() = 'tech_support');

commit;