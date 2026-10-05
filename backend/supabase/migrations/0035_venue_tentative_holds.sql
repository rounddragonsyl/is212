-- US "Submit venue booking request" / "Tentative hold" (venue booking slice).
-- Tightens who may hold a venue, caps an event at one live hold, and notifies Venue Staff
-- when a request is submitted. Apply after 0018. Safe to replay.
begin;

-- AC: an event can have at most one active tentative hold at a time. A partial unique index
-- is the only version of this rule two coordinators racing cannot both get past; the
-- pre-check in holdVenue() exists to give a readable message, not to enforce it.
create unique index if not exists venue_bookings_one_live_per_event
  on public.venue_bookings (event_id)
  where (status in ('held', 'pending_approval', 'confirmed'));

-- AC: a hold is for an approved event the coordinator manages. The 0018 insert policy
-- checked neither, so a coordinator could hold a venue for a draft, or for someone else's
-- event. Replaces that policy rather than adding a second one: two permissive INSERT
-- policies are OR-ed, so the looser one would keep winning.
drop policy if exists bookings_insert_coordinator on public.venue_bookings;
create policy bookings_insert_coordinator on public.venue_bookings
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and requested_by = auth.uid()
    and status = 'held'
    and exists (
      select 1 from public.events e
      where e.id = venue_bookings.event_id
        and e.coordinator_id = auth.uid()
        and e.status in ('approved', 'planning')
    )
  );

-- AC: a tentative hold is released automatically when its event is cancelled, postponed or
-- withdrawn. Deleting the claims is what frees the slots; the booking row stays as history.
create or replace function public.release_holds_on_event_close()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('cancelled', 'rejected') then return new; end if;
  if old.status = new.status then return new; end if;

  delete from public.venue_slot_claims c
   using public.venue_bookings b
   where c.booking_id = b.id
     and b.event_id = new.id
     and b.status in ('held', 'pending_approval');

  update public.venue_bookings
     set status = 'cancelled'
   where event_id = new.id
     and status in ('held', 'pending_approval');

  return new;
end;
$$;
revoke execute on function public.release_holds_on_event_close() from public, anon, authenticated;

drop trigger if exists events_release_venue_holds on public.events;
create trigger events_release_venue_holds
  after update of status on public.events
  for each row execute function public.release_holds_on_event_close();

-- AC: Venue Staff are notified when a new booking request is submitted. Follows the
-- change-request pattern in 0016: a row per recipient, written by a trigger so a client
-- that dies mid-submit cannot leave a request nobody was told about.
create table if not exists public.venue_booking_notifications (
  id                uuid primary key default gen_random_uuid(),
  venue_booking_id  uuid not null references public.venue_bookings (id) on delete cascade,
  venue_id          uuid not null references public.venues (id),
  recipient_id      uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  unique (venue_booking_id, recipient_id)
);
create index if not exists venue_booking_notifications_recipient_idx
  on public.venue_booking_notifications (recipient_id, created_at desc);

alter table public.venue_booking_notifications enable row level security;
revoke all on public.venue_booking_notifications from public, anon, authenticated;
grant select, update on public.venue_booking_notifications to authenticated;

drop policy if exists venue_staff_read_own_booking_notifications on public.venue_booking_notifications;
create policy venue_staff_read_own_booking_notifications on public.venue_booking_notifications
  for select to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() = 'venue_staff');

drop policy if exists venue_staff_mark_own_booking_notifications on public.venue_booking_notifications;
create policy venue_staff_mark_own_booking_notifications on public.venue_booking_notifications
  for update to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() = 'venue_staff')
  with check (recipient_id = auth.uid());

create or replace function public.notify_venue_staff_of_booking_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only the held -> pending_approval transition is a new request to review.
  if new.status <> 'pending_approval' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending_approval' then return new; end if;

  insert into public.venue_booking_notifications (venue_booking_id, venue_id, recipient_id)
  select new.id, new.venue_id, p.id
    from public.profiles p
   where p.role = 'venue_staff'
  on conflict (venue_booking_id, recipient_id) do nothing;

  return new;
end;
$$;
revoke execute on function public.notify_venue_staff_of_booking_request() from public, anon, authenticated;

drop trigger if exists venue_bookings_notify_staff on public.venue_bookings;
create trigger venue_bookings_notify_staff
  after insert or update of status on public.venue_bookings
  for each row execute function public.notify_venue_staff_of_booking_request();

commit;
