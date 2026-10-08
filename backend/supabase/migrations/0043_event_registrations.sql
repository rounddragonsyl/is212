-- 0043_event_registrations.sql — US15 (SCRUM-22): Attendees register for confirmed events.
--
-- The browser talks to Supabase directly, so every rule that matters lives here:
--   * "open for registration" (AC-015.4, AC-015.6) is checked inside register_for_event;
--   * one active registration per attendee and event (AC-015.5) is a unique index;
--   * Attendees read events only through functions that return public fields (AC-015.1).
-- No existing migration or row is changed apart from adding one nullable column to events.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Prerequisites shown to Attendees (AC-015.1)
-- ---------------------------------------------------------------------------
-- Nullable: most events have none, and drafts must stay saveable without it. No screen edits
-- it yet; US52's coordinator screen is the natural home. Until then an administrator sets it.
alter table public.events add column if not exists registration_prerequisites text;

-- ---------------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------------
create table if not exists public.event_registrations (
  id                      uuid primary key default gen_random_uuid(),
  -- restrict: a registration is a record of who signed up; it should not vanish with an
  -- event row. Confirmed events are cancelled, never deleted, in the normal lifecycle.
  event_id                uuid not null references public.events (id) on delete restrict,
  -- cascade: when an account is deleted, its personal answers go with it.
  attendee_id             uuid not null references public.profiles (id) on delete cascade,
  -- 'withdrawn' is allowed now so US23 can add withdrawal without changing this table.
  status                  text not null default 'registered',
  phone                   text not null,
  dietary_requirements    text,
  accessibility_needs     text,
  prerequisites_confirmed boolean not null default false,
  registered_at           timestamptz not null default now(),
  withdrawn_at            timestamptz,

  constraint event_registrations_status_valid
    check (status in ('registered', 'withdrawn')),
  constraint event_registrations_withdrawn_at_matches_status
    check ((status = 'withdrawn') = (withdrawn_at is not null)),
  constraint event_registrations_phone_present
    check (btrim(phone) <> '')
);

-- AC-015.5 as a constraint, not a check-then-insert: two clicks or two tabs racing each other
-- both reach the insert, and the index lets exactly one of them through. Partial, so a
-- withdrawn registration (US23) does not stop the same person registering again.
create unique index if not exists event_registrations_one_active
  on public.event_registrations (event_id, attendee_id)
  where status = 'registered';

alter table public.event_registrations enable row level security;

-- Writes only through register_for_event (and later US23's withdrawal), both running as the
-- owner. Revoked rather than left without policies, so a direct attempt is refused outright.
revoke all on public.event_registrations from public, anon, authenticated;
grant select on public.event_registrations to authenticated;

drop policy if exists event_registrations_select_own on public.event_registrations;
create policy event_registrations_select_own on public.event_registrations
  for select to authenticated
  using (attendee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared helpers (not APIs)
-- ---------------------------------------------------------------------------
-- The definition of "open for registration" (US15 D2), written once so the list, the details
-- and the registration itself can never disagree. now() is the transaction's start time.
create or replace function public.event_is_open_for_registration(
  event_status text, registration_enabled boolean, event_start timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select event_status = 'confirmed' and registration_enabled and event_start > now();
$$;

-- "Venue (Location)" for each confirmed venue booking, or null while none is confirmed. Held
-- and pending bookings are plans, not a venue an Attendee should travel to (US15 A4).
create or replace function public.event_venue_label(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select string_agg(
           v.name || coalesce(' (' || nullif(btrim(v.location), '') || ')', ''),
           ', ' order by v.name)
  from public.venue_bookings b
  join public.venues v on v.id = b.venue_id
  where b.event_id = p_event_id and b.status = 'confirmed';
$$;

revoke execute on function public.event_is_open_for_registration(text, boolean, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.event_venue_label(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What Attendees can read (AC-015.1, AC-015.6, AC-015.7)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER functions instead of a policy on events: RLS filters rows, not columns, so
-- a policy would hand Attendees every column of an open event (budget purpose, organiser,
-- special arrangements). These return public fields only.
create or replace function public.list_open_events()
returns table (
  id uuid, name text, event_type text, proposed_start timestamptz, proposed_end timestamptz,
  venue text, registered boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.event_type, e.proposed_start, e.proposed_end,
         public.event_venue_label(e.id),
         exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.attendee_id = auth.uid()
                    and r.status = 'registered')
  from public.events e
  where public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start)
  order by e.proposed_start, e.id;
$$;

create or replace function public.get_open_event(p_event_id uuid)
returns table (
  id uuid, name text, event_type text, description text, programme text,
  proposed_start timestamptz, proposed_end timestamptz, prerequisites text, venue text,
  registered boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.event_type, e.description, e.programme,
         e.proposed_start, e.proposed_end, e.registration_prerequisites,
         public.event_venue_label(e.id),
         exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.attendee_id = auth.uid()
                    and r.status = 'registered')
  from public.events e
  where e.id = p_event_id
    and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start);
$$;

-- Registrations stay listed after the event closes, is completed or is cancelled, so the
-- Attendee can see what happened to an event they signed up for (AC-015.7). A registered event
-- can only be confirmed, completed or cancelled (0004), so no internal status reaches here.
create or replace function public.list_my_registrations()
returns table (
  registration_id uuid, event_id uuid, event_name text, proposed_start timestamptz,
  proposed_end timestamptz, venue text, event_status text, registration_status text,
  registered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, e.id, e.name, e.proposed_start, e.proposed_end,
         public.event_venue_label(e.id), e.status, r.status, r.registered_at
  from public.event_registrations r
  join public.events e on e.id = r.event_id
  where r.attendee_id = auth.uid()
  order by e.proposed_start, r.registered_at;
$$;

-- Signed-in users only: the list is public information inside the app, but visitors who are
-- not signed in get nothing (US15 A5).
revoke execute on function public.list_open_events() from public, anon;
revoke execute on function public.get_open_event(uuid) from public, anon;
revoke execute on function public.list_my_registrations() from public, anon;
grant execute on function public.list_open_events() to authenticated;
grant execute on function public.get_open_event(uuid) to authenticated;
grant execute on function public.list_my_registrations() to authenticated;

-- ---------------------------------------------------------------------------
-- Registering (AC-015.2, AC-015.4, AC-015.5)
-- ---------------------------------------------------------------------------
-- The only way to create a registration. The attendee is always the caller: no parameter can
-- name another user. Errors use distinct codes so the app can say something specific:
--   42501 not an Attendee · 22000 not open · 22023 invalid answers · 23505 already registered.
create or replace function public.register_for_event(
  p_event_id uuid,
  p_phone text,
  p_dietary_requirements text,
  p_accessibility_needs text,
  p_prerequisites_confirmed boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  prerequisites text;
  phone text := btrim(coalesce(p_phone, ''));
  new_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can register for events' using errcode = '42501';
  end if;

  -- FOR SHARE: the event cannot be closed, cancelled or have registration switched off
  -- between this check and the insert below.
  select e.registration_prerequisites into prerequisites
  from public.events e
  where e.id = p_event_id
    and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start)
  for share;

  if not found then
    raise exception 'Registration is not open for this event' using errcode = '22000';
  end if;

  -- Same rule as the form (US15 A1): 8 to 15 digits once spaces and hyphens are removed,
  -- with an optional leading +.
  if phone = '' then
    raise exception 'Enter a phone number.' using errcode = '22023';
  end if;
  if regexp_replace(phone, '[[:space:]-]', '', 'g') !~ '^\+?[0-9]{8,15}$' then
    raise exception 'Enter a phone number of 8 to 15 digits.' using errcode = '22023';
  end if;

  if nullif(btrim(prerequisites), '') is not null and not coalesce(p_prerequisites_confirmed, false) then
    raise exception 'Confirm that you meet the prerequisites.' using errcode = '22023';
  end if;

  -- A second active registration fails here with 23505 (event_registrations_one_active).
  insert into public.event_registrations
    (event_id, attendee_id, phone, dietary_requirements, accessibility_needs, prerequisites_confirmed)
  values
    (p_event_id, auth.uid(), phone, nullif(btrim(p_dietary_requirements), ''),
     nullif(btrim(p_accessibility_needs), ''), coalesce(p_prerequisites_confirmed, false))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.register_for_event(uuid, text, text, text, boolean)
  from public, anon;
grant execute on function public.register_for_event(uuid, text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmation email (AC-015.3)
-- ---------------------------------------------------------------------------
-- Same mechanism as US4/US7/US14: a row in notification_outbox, sent by the existing
-- send-review-notifications Edge Function. A trigger rather than code in register_for_event,
-- so any future way of creating a registration also sends it. It runs in the same
-- transaction: if the email cannot be queued, the registration is rolled back too.
create or replace function public.queue_registration_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient text;
  event_name text;
  event_start timestamptz;
  venue text;
begin
  select u.email into recipient from auth.users u where u.id = new.attendee_id;
  -- No address, nothing to send; the registration itself still stands.
  if recipient is null then
    return new;
  end if;

  select e.name, e.proposed_start, public.event_venue_label(e.id)
    into event_name, event_start, venue
  from public.events e
  where e.id = new.event_id;

  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  values (
    new.event_id,
    recipient,
    'You are registered for ' || coalesce(event_name, 'your event'),
    'You are registered for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      -- Singapore time explicitly: the server's time zone is not the Attendee's.
      || 'When: ' || to_char(event_start at time zone 'Asia/Singapore', 'FMDD Mon YYYY, HH24:MI')
      || ' (Singapore time)' || E'\n'
      || 'Where: ' || coalesce(venue, 'Venue to be confirmed') || E'\n\n'
      || 'You can see all your registrations under My registrations in ConnectSphere.'
  );

  return new;
end;
$$;

revoke execute on function public.queue_registration_confirmation() from public, anon, authenticated;

drop trigger if exists event_registrations_queue_confirmation on public.event_registrations;
create trigger event_registrations_queue_confirmation
  after insert on public.event_registrations
  for each row execute function public.queue_registration_confirmation();
