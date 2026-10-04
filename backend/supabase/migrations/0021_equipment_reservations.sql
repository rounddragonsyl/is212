-- US14 (SCRUM-20): Technical Support reserves equipment for requirements recorded in US13.
-- Apply after 0020. Builds on Nicole's 0019 units, booking lines and allocations (agreed
-- 4 October); no parallel catalogue. 0019 and 0020 are not edited: every change to their
-- tables is an ALTER here.
--
-- Window rules (#5, #13, #36): days are Singapore dates. Each unit is blocked from the
-- collection day (first day - 1), or one day earlier when it is not already at one of the
-- event's approved venues, through the return day. It is free again from return day + 1.
-- Blocking whole days is what keeps same-day AM and PM events from sharing a unit.
begin;

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
-- AC-014.10: 0019 records who reserved a unit but not when.
alter table public.equipment_allocations
  add column if not exists reserved_at timestamptz not null default now();

-- An event may have no approved venue yet (A8), so its equipment booking may have no
-- delivery venue until one is approved.
alter table public.equipment_bookings alter column deliver_to_venue_id drop not null;

-- AC-014.13 reuses US13's notification table for the Event Coordinator's outcome notices,
-- with the per-type channel settings pattern from US7 (#37).
alter table public.equipment_requirement_notifications
  add column if not exists quantity_reserved integer,
  add column if not exists alternative_type_name text,
  add column if not exists alternative_note text,
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists email_outbox_id uuid references public.notification_outbox (id) on delete set null;
alter table public.equipment_requirement_notifications
  drop constraint if exists equipment_requirement_notifications_action_check;
alter table public.equipment_requirement_notifications
  drop constraint if exists equipment_requirement_notifications_action_valid;
alter table public.equipment_requirement_notifications
  add constraint equipment_requirement_notifications_action_valid check (action in
    ('added', 'changed', 'removed', 'reserved', 'partially_reserved', 'unavailable'));

-- Coordinators read their own outcome notices; US13's policy still serves Technical Support.
drop policy if exists equipment_outcome_notices_select_coordinator on public.equipment_requirement_notifications;
create policy equipment_outcome_notices_select_coordinator on public.equipment_requirement_notifications
  for select to authenticated
  using (recipient_id = auth.uid() and in_app_enabled and public.current_user_role() = 'coordinator');

create table if not exists public.equipment_notification_settings (
  notification_type text primary key check (notification_type in ('equipment_requirement_outcome')),
  in_app_enabled    boolean not null default true,
  email_enabled     boolean not null default true
);
insert into public.equipment_notification_settings (notification_type)
values ('equipment_requirement_outcome') on conflict do nothing;
alter table public.equipment_notification_settings enable row level security;
revoke all on public.equipment_notification_settings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Direct-write lockdown (agreed with Nicole)
-- ---------------------------------------------------------------------------
-- 0019 let Technical Support write allocations, lines and bookings directly, which would
-- skip every rule below (window, unusable units, availability). Reads stay; writes now
-- happen only inside reserve_equipment and change_equipment_return_date. 0019's
-- coordinator policies, including accept/decline of suggestions, are left as they were.
drop policy if exists allocations_tech_support on public.equipment_allocations;
drop policy if exists allocations_select_staff on public.equipment_allocations;
create policy allocations_select_staff on public.equipment_allocations
  for select to authenticated
  using (public.current_user_role() in ('tech_support', 'operations_manager'));
drop policy if exists eq_lines_tech_support on public.equipment_booking_lines;
drop policy if exists eq_bookings_review_tech_support on public.equipment_bookings;

-- ---------------------------------------------------------------------------
-- Availability (AC-014.2, .3, .5, .6, .11)
-- ---------------------------------------------------------------------------
-- Internal: operational units of a type that are free for this event's window, with each
-- unit's own start day. p_ignore_line excludes a line's own allocations when re-checking.
create or replace function public.equipment_free_units(
  p_type_id uuid, p_event_id uuid, p_first_day date, p_return_date date, p_ignore_line uuid default null)
returns table (item_id uuid, asset_tag text, at_venue boolean, blocked_from date)
language sql stable security definer set search_path = '' as $$
  with approved_venues as (
    -- Only approved bookings count; a tentative hold may still fall through (A2).
    select vb.venue_id from public.venue_bookings vb
    where vb.event_id = p_event_id and vb.status = 'confirmed'
  ), units as (
    select i.id, i.asset_tag,
           i.current_venue_id in (select venue_id from approved_venues) as at_venue
    from public.equipment_items i
    -- Damaged, under-repair, retired and missing units never count (AC-014.6).
    where i.type_id = p_type_id and i.operational_status = 'operational'
  )
  select u.id, u.asset_tag, u.at_venue,
         p_first_day - case when u.at_venue then 1 else 2 end
  from units u
  where not exists (
    select 1 from public.equipment_allocations a
    where a.item_id = u.id and a.status <> 'cancelled'
      and (p_ignore_line is null or a.line_id <> p_ignore_line)
      and daterange(a.blocked_from, a.blocked_to, '[]')
          && daterange(p_first_day - case when u.at_venue then 1 else 2 end, p_return_date, '[]'));
$$;
revoke all on function public.equipment_free_units(uuid, uuid, date, date, uuid) from public, anon, authenticated;

-- Internal: an event's first and last Singapore days (#36).
create or replace function public.event_days_sgt(p_event_id uuid, out first_day date, out last_day date)
language sql stable security definer set search_path = '' as $$
  select (e.proposed_start at time zone 'Asia/Singapore')::date,
         (coalesce(e.proposed_end, e.proposed_start) at time zone 'Asia/Singapore')::date
  from public.events e where e.id = p_event_id;
$$;
revoke all on function public.event_days_sgt(uuid) from public, anon, authenticated;

-- Internal: refuse anyone who is not Technical Support. SECURITY DEFINER callers bypass RLS,
-- so each public function must check the caller's role itself (AC-014.7).
create or replace function public.require_tech_support()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'tech_support' then
    raise exception 'Only Technical Support Staff can reserve equipment' using errcode = '42501';
  end if;
end $$;
revoke all on function public.require_tech_support() from public, anon, authenticated;

-- SECURITY DEFINER because units, allocations and venue bookings are deliberately hidden
-- from most roles; the role check above is what admits only Technical Support.
create or replace function public.equipment_available_units(p_requirement_id uuid, p_return_date date default null)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  requirement public.event_equipment_requirements;
  days record;
begin
  perform public.require_tech_support();
  select * into requirement from public.event_equipment_requirements where id = p_requirement_id;
  if not found then
    raise exception 'Equipment requirement not found' using errcode = '22000';
  end if;
  select * into days from public.event_days_sgt(requirement.event_id);
  return (select count(*) from public.equipment_free_units(requirement.type_id, requirement.event_id,
    days.first_day, coalesce(p_return_date, days.last_day)));
end $$;
revoke all on function public.equipment_available_units(uuid, date) from public, anon;
grant execute on function public.equipment_available_units(uuid, date) to authenticated;

-- AC-014.1: essential requirements pending review on events still eligible for equipment.
-- Non-essential lines were decided after a shortfall review, so they are not pending (#106).
create or replace function public.equipment_review_queue()
returns table (requirement_id uuid, event_id uuid, event_reference text, event_name text,
  proposed_start timestamptz, proposed_end timestamptz, type_id uuid, type_name text,
  quantity_requested integer, technical_notes text, available integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.require_tech_support();
  return query
  select r.id, e.id, e.reference, e.name, e.proposed_start, e.proposed_end, r.type_id, t.name,
         r.quantity, r.technical_notes,
         (select count(*)::integer
          from public.equipment_free_units(r.type_id, e.id, days.first_day, days.last_day))
  from public.event_equipment_requirements r
  join public.events e on e.id = r.event_id
  join public.equipment_types t on t.id = r.type_id
  cross join lateral public.event_days_sgt(e.id) days
  where r.status = 'pending_review' and r.essential
    and e.status in ('approved', 'planning', 'confirmed')
  order by e.proposed_start, t.name;
end $$;
revoke all on function public.equipment_review_queue() from public, anon;
grant execute on function public.equipment_review_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- Coordinator outcome notices (AC-014.13)
-- ---------------------------------------------------------------------------
create or replace function public.queue_equipment_outcome_notice(
  p_requirement public.event_equipment_requirements, p_event public.events, p_action text,
  p_reserved integer, p_alternative_type_id uuid, p_alternative_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  settings public.equipment_notification_settings;
  type_name text;
  alternative_name text;
  recipient_email text;
  outbox_id uuid;
begin
  if p_event.coordinator_id is null then return; end if;
  select * into settings from public.equipment_notification_settings
    where notification_type = 'equipment_requirement_outcome';
  if not found or not (settings.in_app_enabled or settings.email_enabled) then return; end if;
  select t.name into type_name from public.equipment_types t where t.id = p_requirement.type_id;
  select t.name into alternative_name from public.equipment_types t where t.id = p_alternative_type_id;

  if settings.email_enabled then
    select u.email into recipient_email from auth.users u where u.id = p_event.coordinator_id;
    if nullif(btrim(recipient_email), '') is not null then
      insert into public.notification_outbox (event_id, recipient_email, subject, body)
      values (p_event.id, recipient_email,
        'Equipment update for ' || coalesce(p_event.reference, 'your event'),
        format('%s for %s: %s of %s reserved.%s Sign in to ConnectSphere to see the details.',
          type_name, coalesce(p_event.reference, 'your event'), p_reserved, p_requirement.quantity,
          case when alternative_name is not null then ' Suggested alternative: ' || alternative_name || '.' else '' end))
      returning id into outbox_id;
    end if;
  end if;

  -- The row is kept even with in-app off, so the email it queued stays traceable.
  insert into public.equipment_requirement_notifications (requirement_id, event_id, recipient_id, action,
    type_name, quantity, quantity_reserved, alternative_type_name, alternative_note, in_app_enabled, email_outbox_id)
  values (p_requirement.id, p_event.id, p_event.coordinator_id, p_action, type_name, p_requirement.quantity,
    p_reserved, alternative_name, nullif(btrim(p_alternative_note), ''), settings.in_app_enabled, outbox_id);
end $$;
revoke all on function public.queue_equipment_outcome_notice(public.event_equipment_requirements, public.events,
  text, integer, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reserving (AC-014.4, .7 to .13)
-- ---------------------------------------------------------------------------
-- One transaction checks, picks units, writes and notifies; the browser never checks
-- availability itself. A per-type advisory lock serialises every reservation and return-
-- date change for that type, so a second caller re-counts only after the first commits
-- (AC-014.12). Different types never wait for each other. 0019's no-double-allocation
-- constraint remains the last line of defence.
create or replace function public.lock_equipment_type(p_type_id uuid)
returns void language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('equipment_type:' || p_type_id::text, 0));
$$;
revoke all on function public.lock_equipment_type(uuid) from public, anon, authenticated;

create or replace function public.reserve_equipment(
  p_requirement_id uuid, p_quantity integer, p_return_date date default null,
  p_alternative_type_id uuid default null, p_alternative_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  requirement public.event_equipment_requirements;
  event_row public.events;
  days record;
  return_day date;
  available integer;
  outcome text;
  booking uuid;
  line uuid;
  unit record;
begin
  perform public.require_tech_support();
  select * into requirement from public.event_equipment_requirements where id = p_requirement_id;
  if not found then
    raise exception 'Equipment requirement not found' using errcode = '22000';
  end if;
  perform public.lock_equipment_type(requirement.type_id);
  -- Re-read under the lock: the line may have been decided while this call waited.
  select * into requirement from public.event_equipment_requirements where id = p_requirement_id for update;
  if requirement.status <> 'pending_review' then
    raise exception 'This requirement is no longer pending review' using errcode = '22000';
  end if;
  select * into event_row from public.events where id = requirement.event_id;
  if event_row.status not in ('approved', 'planning', 'confirmed') then
    raise exception 'Equipment can only be reserved for approved events' using errcode = '22000';
  end if;

  select * into days from public.event_days_sgt(event_row.id);
  return_day := coalesce(p_return_date, days.last_day);
  if return_day < days.last_day then
    raise exception 'The return date cannot be before the event''s last day' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > requirement.quantity then
    raise exception 'Reserve between 0 and % units', requirement.quantity using errcode = '22023';
  end if;

  select count(*) into available from public.equipment_free_units(requirement.type_id, event_row.id,
    days.first_day, return_day);
  if p_quantity > available then
    raise exception 'Only % available for this window', available using errcode = '23P01';
  end if;
  -- Partial only when fewer units are available than requested (A3, AC-014.8 wording).
  if p_quantity < requirement.quantity and available >= requirement.quantity then
    raise exception 'Enough units are available to reserve the full quantity' using errcode = '22023';
  end if;
  if p_alternative_type_id is not null then
    if p_quantity >= requirement.quantity then
      raise exception 'An alternative can only be suggested for a shortfall' using errcode = '22023';
    end if;
    if p_alternative_type_id = requirement.type_id
       or not exists (select 1 from public.equipment_types where id = p_alternative_type_id) then
      raise exception 'Choose a different equipment type from the catalogue' using errcode = '22023';
    end if;
  end if;

  outcome := case when p_quantity = requirement.quantity then 'reserved'
                  when p_quantity > 0 then 'partially_reserved' else 'unavailable' end;

  -- One equipment booking per event, widened to cover every line's window (A8).
  select b.id into booking from public.equipment_bookings b
    where b.event_id = event_row.id order by b.created_at limit 1 for update;
  if booking is null then
    insert into public.equipment_bookings (event_id, requested_by, deliver_to_venue_id, use_from, use_to,
      status, reviewed_by, reviewed_at)
    values (event_row.id, coalesce(event_row.coordinator_id, auth.uid()),
      (select vb.venue_id from public.venue_bookings vb
        where vb.event_id = event_row.id and vb.status = 'confirmed' order by vb.created_at limit 1),
      days.first_day - 1, return_day, 'confirmed', auth.uid(), now())
    returning id into booking;
  else
    update public.equipment_bookings
      set use_from = least(use_from, days.first_day - 1), use_to = greatest(use_to, return_day)
      where id = booking;
  end if;

  insert into public.equipment_booking_lines (booking_id, type_id, quantity_requested, status, assessed_by, assessed_at)
  values (booking, requirement.type_id, requirement.quantity,
    case outcome when 'reserved' then 'fulfilled' when 'partially_reserved' then 'partially_fulfilled' else 'unavailable' end,
    auth.uid(), now())
  returning id into line;

  -- Units already at an approved venue first (#66); the transfer day applies per unit (#13).
  for unit in
    select f.item_id, f.blocked_from
    from public.equipment_free_units(requirement.type_id, event_row.id, days.first_day, return_day) f
    order by f.at_venue desc, f.asset_tag
    limit p_quantity
  loop
    insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
    values (line, unit.item_id, requirement.type_id, unit.blocked_from, return_day, 'reserved', auth.uid());
  end loop;

  -- The structured alternative from 0019; the Coordinator's accept/decline is out of scope (#90).
  if p_alternative_type_id is not null then
    insert into public.equipment_booking_lines (booking_id, type_id, origin, substitutes_line_id,
      quantity_requested, status, assessment_note, assessed_by, assessed_at)
    values (booking, p_alternative_type_id, 'suggested', line, requirement.quantity - p_quantity, 'proposed',
      nullif(btrim(p_alternative_note), ''), auth.uid(), now());
  end if;

  -- US13's triggers see a status-only change: no Technical Support notice, no reset.
  update public.event_equipment_requirements set status = outcome, booking_line_id = line
    where id = requirement.id;
  perform public.queue_equipment_outcome_notice(requirement, event_row, outcome, p_quantity,
    p_alternative_type_id, p_alternative_note);

  return jsonb_build_object('status', outcome, 'reserved', p_quantity, 'requested', requirement.quantity);
end $$;
revoke all on function public.reserve_equipment(uuid, integer, date, uuid, text) from public, anon;
grant execute on function public.reserve_equipment(uuid, integer, date, uuid, text) to authenticated;

-- Extending re-checks every held unit under the same lock; shortening frees days (A1).
create or replace function public.change_equipment_return_date(p_requirement_id uuid, p_return_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  requirement public.event_equipment_requirements;
  days record;
begin
  perform public.require_tech_support();
  select * into requirement from public.event_equipment_requirements where id = p_requirement_id;
  if not found then
    raise exception 'Equipment requirement not found' using errcode = '22000';
  end if;
  perform public.lock_equipment_type(requirement.type_id);
  select * into requirement from public.event_equipment_requirements where id = p_requirement_id for update;
  if requirement.booking_line_id is null or requirement.status not in ('reserved', 'partially_reserved') then
    raise exception 'This requirement has no reserved equipment' using errcode = '22000';
  end if;
  select * into days from public.event_days_sgt(requirement.event_id);
  if p_return_date is null or p_return_date < days.last_day then
    raise exception 'The return date cannot be before the event''s last day' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.equipment_allocations mine
    join public.equipment_allocations other
      on other.item_id = mine.item_id and other.id <> mine.id and other.status <> 'cancelled'
    where mine.line_id = requirement.booking_line_id and mine.status = 'reserved'
      and daterange(other.blocked_from, other.blocked_to, '[]') && daterange(mine.blocked_from, p_return_date, '[]')
  ) then
    raise exception 'Some of these units are already reserved for those days' using errcode = '23P01';
  end if;
  update public.equipment_allocations set blocked_to = p_return_date
    where line_id = requirement.booking_line_id and status = 'reserved';
end $$;
revoke all on function public.change_equipment_return_date(uuid, date) from public, anon;
grant execute on function public.change_equipment_return_date(uuid, date) to authenticated;

commit;
