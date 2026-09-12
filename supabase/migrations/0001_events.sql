-- 0001_events.sql — profiles, events, reference assignment, RLS.
-- Story US-005 (submit an event request). Written so US-004 (save a draft) is not blocked.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Supabase owns auth.users and we cannot add columns to it, so application-level
-- identity (role, organisation) lives here, keyed 1:1 on the auth user id.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null,
  role          text not null,
  client_org_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- CHECK rather than a Postgres enum type: adding a value to an enum needs a
  -- migration with locking semantics we do not want mid-sprint, and a CHECK gives
  -- the same integrity guarantee.
  constraint profiles_role_valid check (
    role in ('organiser', 'coordinator', 'venue_staff', 'tech_support', 'attendee')
  )
);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id                         uuid primary key default gen_random_uuid(),

  -- Null until the request is submitted. US-004 drafts have no reference, and a
  -- unique index ignores nulls, so many drafts can coexist.
  reference                  text unique,

  organiser_id               uuid not null references public.profiles (id) on delete restrict,

  name                       text,
  purpose                    text,
  event_type                 text,
  description                text,
  proposed_start             timestamptz,
  proposed_end               timestamptz,
  expected_attendance        integer,
  programme                  text,
  layout_preference          text,
  accessibility_requirements text,
  equipment_requirements     text,
  registration_required      boolean not null default false,
  special_arrangements       text,

  status                     text not null default 'draft',

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  submitted_at               timestamptz,

  constraint events_status_valid check (
    status in ('draft', 'submitted', 'under_review', 'approved',
               'planning', 'confirmed', 'completed', 'cancelled', 'rejected')
  ),

  -- AC-005.2, database half. The client Zod schema rejects these for a good error
  -- message; this constraint makes an invalid submitted row impossible even if a
  -- caller bypasses the UI and posts straight to PostgREST. Deliberate defence in
  -- depth, not accidental duplication.
  --
  -- Keyed on status rather than NOT NULL columns because a draft (US-004) may
  -- legitimately have none of these filled in yet.
  constraint submitted_requires_core_fields check (
    status = 'draft' or (
      purpose is not null and btrim(purpose) <> ''
      and proposed_start is not null
      and expected_attendance is not null
    )
  ),

  -- Null-tolerant by design: NULL comparisons yield NULL, which satisfies a CHECK,
  -- so an empty draft passes and a filled-in one is still policed.
  constraint events_attendance_positive check (expected_attendance is null or expected_attendance > 0),

  -- Half-open interval [start, end): an event that ends exactly when another starts
  -- does not overlap it. Zero-length events are rejected.
  constraint events_interval_ordered check (
    proposed_start is null or proposed_end is null or proposed_end > proposed_start
  )
);

create index if not exists events_organiser_id_idx on public.events (organiser_id);
create index if not exists events_status_idx on public.events (status);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reference assignment — AC-005.5
-- ---------------------------------------------------------------------------
-- A single global sequence, not a per-year counter. Per-year numbering would need a
-- counter table and a row lock on every submission, serialising submissions for a
-- gain AC-005.5 does not ask for: it requires a *unique* reference, not a gapless
-- one. Consequence to state in the design doc: numbers do not restart each January.
create sequence if not exists public.event_reference_seq;

create or replace function public.assign_event_reference()
returns trigger
language plpgsql
as $$
begin
  -- Fire only on the transition *into* submitted, so re-saving a submitted event
  -- keeps its original reference and submission timestamp.
  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then

    if new.reference is null then
      new.reference := 'EVT-' || to_char(now(), 'YYYY') || '-'
                    || lpad(nextval('public.event_reference_seq')::text, 4, '0');
    end if;

    new.submitted_at := coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists events_assign_reference on public.events;
create trigger events_assign_reference
  before insert or update on public.events
  for each row execute function public.assign_event_reference();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Core feature #1: a user sees only what their role and relationship to an event
-- allow. Enforced here rather than by hiding buttons in React, so a direct PostgREST
-- call from a signed-in organiser cannot reach another organiser's event.
alter table public.profiles enable row level security;
alter table public.events   enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated
  using (organiser_id = auth.uid());

-- WITH CHECK on insert stops an organiser from filing a request in someone else's
-- name; without it, organiser_id would be a client-supplied value we simply trust.
drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert to authenticated
  with check (organiser_id = auth.uid());

-- USING gates which rows may be updated; WITH CHECK gates what they may become.
-- Both are needed, or an organiser could hand their event to another organiser.
drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
  for update to authenticated
  using (organiser_id = auth.uid())
  with check (organiser_id = auth.uid());
