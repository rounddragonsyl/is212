-- US18/US19 venue foundation: time slots, venues, closures, bookings and the slot ledger.
-- Depends on public.events, public.profiles, public.set_updated_at() and
-- public.current_user_role(). Apply after the events/profiles migrations.
-- "if not exists" leaves an existing table untouched, so drop any older draft of these
-- tables in your dev project before applying this file.
begin;

create extension if not exists btree_gist;

create table if not exists public.time_slots (
  code       text primary key check (code in ('AM', 'PM', 'NIGHT')),
  starts_at  time not null,
  ends_at    time not null,
  sort_order integer not null unique
);
insert into public.time_slots (code, starts_at, ends_at, sort_order) values
  ('AM', '07:00', '12:00', 1),
  ('PM', '13:00', '18:00', 2),
  ('NIGHT', '19:00', '24:00', 3)
on conflict (code) do nothing;

create table if not exists public.venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  location      text not null default '',
  capacity      integer not null check (capacity > 0),
  layout        text not null,
  accessibility text[] not null default '{}',
  facility      jsonb not null default '{}'::jsonb,
  status        text not null default 'active'
    check (status in ('active', 'under_maintenance', 'retired')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.venue_closures (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id),
  starts_on  date not null,
  ends_on    date not null check (ends_on >= starts_on),
  reason     text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (id, venue_id),
  constraint no_overlapping_closures
    exclude using gist (venue_id with =, daterange(starts_on, ends_on, '[]') with &&)
);

create table if not exists public.venue_bookings (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id),
  venue_id        uuid not null references public.venues (id),
  requested_by    uuid not null references public.profiles (id),
  status          text not null default 'held'
    check (status in ('held', 'pending_approval', 'confirmed', 'rejected', 'cancelled', 'expired')),
  hold_expires_at timestamptz,
  reviewed_by     uuid references public.profiles (id),
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, venue_id),
  check (status <> 'held' or hold_expires_at is not null)
);
create index if not exists venue_bookings_event_id_idx on public.venue_bookings (event_id);
create index if not exists venue_bookings_venue_status_idx on public.venue_bookings (venue_id, status);

create table if not exists public.venue_slot_claims (
  venue_id   uuid not null references public.venues (id),
  slot_date  date not null,
  slot       text not null references public.time_slots (code),
  kind       text not null check (kind in ('event', 'buffer', 'maintenance')),
  booking_id uuid,
  closure_id uuid,
  primary key (venue_id, slot_date, slot),
  foreign key (booking_id, venue_id)
    references public.venue_bookings (id, venue_id) on delete cascade,
  foreign key (closure_id, venue_id)
    references public.venue_closures (id, venue_id) on delete cascade,
  check ((kind = 'maintenance') = (closure_id is not null)),
  check ((kind <> 'maintenance') = (booking_id is not null))
);
create index if not exists venue_slot_claims_booking_id_idx on public.venue_slot_claims (booking_id);

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists venue_bookings_set_updated_at on public.venue_bookings;
create trigger venue_bookings_set_updated_at
  before update on public.venue_bookings
  for each row execute function public.set_updated_at();

alter table public.time_slots enable row level security;
alter table public.venues enable row level security;
alter table public.venue_closures enable row level security;
alter table public.venue_bookings enable row level security;
alter table public.venue_slot_claims enable row level security;

-- Explicit privileges; the policies below decide which rows these reach.
grant select on public.time_slots to authenticated;
grant select, insert, update, delete on
  public.venues, public.venue_closures, public.venue_bookings, public.venue_slot_claims
  to authenticated;

-- time_slots and venues: any signed-in user may read; venue staff and operations manage.
drop policy if exists time_slots_select_all on public.time_slots;
create policy time_slots_select_all on public.time_slots
  for select to authenticated using (true);

drop policy if exists venues_select_all on public.venues;
create policy venues_select_all on public.venues
  for select to authenticated using (true);

drop policy if exists venues_manage_insert on public.venues;
create policy venues_manage_insert on public.venues
  for insert to authenticated
  with check (public.current_user_role() in ('venue_staff', 'operations_manager'));

drop policy if exists venues_manage_update on public.venues;
create policy venues_manage_update on public.venues
  for update to authenticated
  using (public.current_user_role() in ('venue_staff', 'operations_manager'))
  with check (public.current_user_role() in ('venue_staff', 'operations_manager'));

-- venue_closures: staff roles read; venue staff and operations manage.
drop policy if exists closures_select_staff on public.venue_closures;
create policy closures_select_staff on public.venue_closures
  for select to authenticated
  using (public.current_user_role() in ('coordinator', 'venue_staff', 'operations_manager'));

drop policy if exists closures_insert_manage on public.venue_closures;
create policy closures_insert_manage on public.venue_closures
  for insert to authenticated
  with check (
    public.current_user_role() in ('venue_staff')
    and created_by = auth.uid()
  );

drop policy if exists closures_update_manage on public.venue_closures;
create policy closures_update_manage on public.venue_closures
  for update to authenticated
  using (public.current_user_role() in ('venue_staff'))
  with check (public.current_user_role() in ('venue_staff'));

drop policy if exists closures_delete_manage on public.venue_closures;
create policy closures_delete_manage on public.venue_closures
  for delete to authenticated
  using (public.current_user_role() in ('venue_staff'));

-- venue_bookings
drop policy if exists bookings_select_staff on public.venue_bookings;
create policy bookings_select_staff on public.venue_bookings
  for select to authenticated
  using (public.current_user_role() in ('coordinator', 'venue_staff'));

drop policy if exists bookings_insert_coordinator on public.venue_bookings;
create policy bookings_insert_coordinator on public.venue_bookings
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status = 'held'
  );

-- A coordinator moves their own booking held -> pending_approval, or cancels it.
drop policy if exists bookings_update_own_coordinator on public.venue_bookings;
create policy bookings_update_own_coordinator on public.venue_bookings
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status in ('held', 'pending_approval')
  )
  with check (
    requested_by = auth.uid()
    and status in ('held', 'pending_approval', 'cancelled')
  );

-- Anyone booking a venue may mark other people's lapsed holds as expired,
-- which is what releaseExpiredHolds() in the app does.
drop policy if exists bookings_expire_lapsed_holds on public.venue_bookings;
create policy bookings_expire_lapsed_holds on public.venue_bookings
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and status = 'held' and hold_expires_at < now()
  )
  with check (status = 'expired');

-- Venue staff approve or reject bookings awaiting their decision.
drop policy if exists bookings_review_venue_staff on public.venue_bookings;
create policy bookings_review_venue_staff on public.venue_bookings
  for update to authenticated
  using (public.current_user_role() = 'venue_staff' and status = 'pending_approval')
  with check (status in ('confirmed', 'rejected') and reviewed_by = auth.uid());

-- venue_slot_claims: the calendar cells.
drop policy if exists claims_select_staff on public.venue_slot_claims;
create policy claims_select_staff on public.venue_slot_claims
  for select to authenticated
  using (public.current_user_role() in ('coordinator', 'venue_staff'));

drop policy if exists claims_insert_coordinator on public.venue_slot_claims;
create policy claims_insert_coordinator on public.venue_slot_claims
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and kind in ('event', 'buffer')
    and exists (
      select 1 from public.venue_bookings b
      where b.id = venue_slot_claims.booking_id
        and b.venue_id = venue_slot_claims.venue_id
        and b.requested_by = auth.uid()
    )
  );

drop policy if exists claims_insert_maintenance on public.venue_slot_claims;
create policy claims_insert_maintenance on public.venue_slot_claims
  for insert to authenticated
  with check (
    public.current_user_role() in ('venue_staff')
    and kind = 'maintenance'
  );

-- A coordinator frees the cells of their own booking, or of a lapsed hold.
drop policy if exists claims_delete_coordinator on public.venue_slot_claims;
create policy claims_delete_coordinator on public.venue_slot_claims
  for delete to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and exists (
      select 1 from public.venue_bookings b
      where b.id = venue_slot_claims.booking_id
        and (b.requested_by = auth.uid()
             or (b.status = 'held' and b.hold_expires_at < now()))
    )
  );

-- Venue staff free the cells of a booking they are rejecting.
drop policy if exists claims_delete_venue_staff on public.venue_slot_claims;
create policy claims_delete_venue_staff on public.venue_slot_claims
  for delete to authenticated
  using (
    public.current_user_role() = 'venue_staff'
    and exists (
      select 1 from public.venue_bookings b
      where b.id = venue_slot_claims.booking_id and b.status = 'pending_approval'
    )
  );

commit;