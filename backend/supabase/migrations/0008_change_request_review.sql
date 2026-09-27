-- US7: assigned-coordinator review and atomic application of accepted changes.
-- Run after 0007. Existing requests/events remain; assignment starts unset.
begin;

alter table public.events add column if not exists coordinator_id uuid
  references public.profiles (id);
grant select (coordinator_id) on public.events to authenticated;

-- Existing event UPDATE grants are broad: protect assignment even on direct API calls.
create or replace function public.guard_event_coordinator_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.coordinator_id is not distinct from old.coordinator_id then return new; end if;
  elsif new.coordinator_id is null then
    return new;
  end if;
  if auth.uid() is not null and public.current_user_role() is distinct from 'operations_manager' then
    raise exception 'Only an Operations Manager may assign a coordinator' using errcode = '42501';
  end if;
  if new.status = 'draft' then
    raise exception 'Submit the event before assigning a coordinator' using errcode = '22000';
  end if;
  if new.coordinator_id is not null and not exists (
    select 1 from public.profiles where id = new.coordinator_id and role = 'coordinator'
  ) then
    raise exception 'Choose a coordinator profile' using errcode = '22000';
  end if;
  return new;
end $$;
drop trigger if exists events_guard_coordinator_assignment on public.events;
create trigger events_guard_coordinator_assignment before insert or update on public.events
  for each row execute function public.guard_event_coordinator_assignment();

-- Managers need no general event-write policy. This entry point changes only assignment.
create or replace function public.assign_event_coordinator(p_event_id uuid, p_coordinator_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'operations_manager' then
    raise exception 'Only an Operations Manager may assign a coordinator' using errcode = '42501';
  end if;
  if p_coordinator_id is null then
    raise exception 'Choose a coordinator' using errcode = '22000';
  end if;
  update public.events set coordinator_id = p_coordinator_id
    where id = p_event_id and status <> 'draft';
  if not found then raise exception 'Event unavailable' using errcode = '22000'; end if;
end $$;
revoke all on function public.assign_event_coordinator(uuid, uuid) from public, anon;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;

-- The browser's broad legacy event grants must not bypass the review operation.
-- SECURITY INVOKER is intentional: direct Supabase API calls run as authenticated,
-- whereas our tightly scoped SECURITY DEFINER review function runs as its owner.
create or replace function public.guard_submitted_event_details()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and old.status <> 'draft'
    and (to_jsonb(new) - array['status','review_note','reviewed_at','reviewed_by','updated_at','coordinator_id'])
      is distinct from
        (to_jsonb(old) - array['status','review_note','reviewed_at','reviewed_by','updated_at','coordinator_id']) then
    raise exception 'Submitted event details must be changed through coordinator review'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists events_guard_submitted_details on public.events;
create trigger events_guard_submitted_details before update on public.events
  for each row execute function public.guard_submitted_event_details();

alter table public.event_change_requests
  drop constraint if exists event_change_requests_status_check;
alter table public.event_change_requests add constraint event_change_requests_status_check
  check (status in ('submitted', 'approved', 'partially_approved', 'rejected',
                   'clarification_requested', 'withdrawn'));
alter table public.event_change_requests add column if not exists field_decisions jsonb;

-- Only the review function may write decision metadata. US6 still inserts proposals
-- and withdraws via status. Column privileges also stop modifying proposal values
-- during withdrawal or spoofing a reviewer on insert.
revoke insert, update on public.event_change_requests from public, anon, authenticated;
grant insert (event_id, organiser_id, proposed_changes, reason, status)
  on public.event_change_requests to authenticated;
grant update (status) on public.event_change_requests to authenticated;

drop policy if exists coordinators_select_all_change_requests on public.event_change_requests;
drop policy if exists coordinators_select_assigned_change_requests on public.event_change_requests;
create policy coordinators_select_assigned_change_requests on public.event_change_requests
  for select to authenticated using (
    public.current_user_role() = 'coordinator' and exists (
      select 1 from public.events
      where events.id = event_change_requests.event_id and events.coordinator_id = auth.uid()
    )
  );
drop policy if exists organisers_select_own_change_requests on public.event_change_requests;
create policy organisers_select_own_change_requests on public.event_change_requests
  for select to authenticated using (
    organiser_id = auth.uid() and public.current_user_role() = 'organiser'
  );
drop policy if exists organisers_insert_own_change_requests on public.event_change_requests;
create policy organisers_insert_own_change_requests on public.event_change_requests
  for insert to authenticated with check (
    organiser_id = auth.uid() and public.current_user_role() = 'organiser'
    and status = 'submitted' and exists (
      select 1 from public.events where events.id = event_change_requests.event_id
        and events.organiser_id = auth.uid()
        and events.status in ('submitted', 'under_review', 'approved', 'planning', 'confirmed')
    )
  );
drop policy if exists organisers_withdraw_own_change_requests on public.event_change_requests;
create policy organisers_withdraw_own_change_requests on public.event_change_requests
  for update to authenticated
  using (organiser_id = auth.uid() and public.current_user_role() = 'organiser' and status = 'submitted')
  with check (organiser_id = auth.uid() and public.current_user_role() = 'organiser' and status = 'withdrawn');

-- This function is the only new path for reviewing a proposal. Never accept event
-- values from the reviewer: look them up from the stored organiser proposal instead.
create or replace function public.review_event_change_request(
  p_request_id uuid, p_event_updated_at timestamptz, p_review jsonb
) returns text
language plpgsql security definer set search_path = '' set timezone = 'Asia/Singapore' as $$
declare
  request_row public.event_change_requests%rowtype;
  event_row public.events%rowtype;
  candidate public.events%rowtype;
  entry jsonb;
  field_name text;
  column_name text;
  proposed_value jsonb;
  patch jsonb := '{}';
  decisions jsonb := '[]';
  seen text[] := '{}';
  accepted integer := 0;
  outcome text;
  note text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only the assigned coordinator may review this request' using errcode = '42501';
  end if;
  select * into request_row from public.event_change_requests where id = p_request_id;
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;

  -- Serialise decisions for one event and coordinate with assignment/event edits.
  select * into event_row from public.events where id = request_row.event_id for update;
  if not found or event_row.coordinator_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode = '42501';
  end if;
  select * into request_row from public.event_change_requests where id = p_request_id for update;
  if request_row.status <> 'submitted' then
    raise exception 'This request is no longer pending review' using errcode = '22000';
  end if;
  if event_row.status not in ('submitted', 'under_review', 'approved', 'planning', 'confirmed') then
    raise exception 'This event can no longer be changed' using errcode = '22000';
  end if;
  if p_event_updated_at is null or event_row.updated_at is distinct from p_event_updated_at then
    raise exception 'Event details changed; reload before reviewing' using errcode = '22000';
  end if;
  if jsonb_typeof(p_review) is distinct from 'object'
    or jsonb_typeof(request_row.proposed_changes) is distinct from 'object'
    or request_row.proposed_changes = '{}'::jsonb then
    raise exception 'Invalid review or proposal' using errcode = '22000';
  end if;

  if p_review->>'action' = 'clarify' then
    if p_review - array['action','note'] <> '{}'::jsonb
      or jsonb_typeof(p_review->'note') is distinct from 'string'
      or nullif(btrim(p_review->>'note'), '') is null then
      raise exception 'Explain what the organiser needs to clarify' using errcode = '22000';
    end if;
    outcome := 'clarification_requested';
    note := btrim(p_review->>'note');
  elsif p_review->>'action' = 'decide' then
    if p_review - array['action','decisions'] <> '{}'::jsonb
      or jsonb_typeof(p_review->'decisions') is distinct from 'array' then
      raise exception 'Provide decisions for the proposed changes' using errcode = '22000';
    end if;
    for entry in select value from jsonb_array_elements(p_review->'decisions') loop
      if jsonb_typeof(entry) is distinct from 'object' then
        raise exception 'Invalid field decision' using errcode = '22000';
      end if;
      field_name := entry->>'field';
      if entry - array['field','decision','note'] <> '{}'::jsonb
        or field_name is null or not request_row.proposed_changes ? field_name
        or field_name = any(seen)
        or (entry->>'decision') is null
        or (entry->>'decision') not in ('approved','rejected')
        or (entry ? 'note' and jsonb_typeof(entry->'note') <> 'string') then
        raise exception 'Choose one decision for every proposed field' using errcode = '22000';
      end if;
      seen := array_append(seen, field_name);
      note := btrim(coalesce(entry->>'note', ''));
      if entry->>'decision' = 'rejected' and note = '' then
        raise exception 'Explain each rejected change' using errcode = '22000';
      end if;
      column_name := case field_name
        when 'name' then 'name' when 'purpose' then 'purpose'
        when 'eventType' then 'event_type' when 'description' then 'description'
        when 'proposedStart' then 'proposed_start' when 'proposedEnd' then 'proposed_end'
        when 'expectedAttendance' then 'expected_attendance' when 'programme' then 'programme'
        when 'layoutPreference' then 'layout_preference'
        when 'accessibilityRequirements' then 'accessibility_requirements'
        when 'equipmentRequirements' then 'equipment_requirements'
        when 'registrationRequired' then 'registration_required'
        when 'specialArrangements' then 'special_arrangements' end;
      if column_name is null then
        raise exception 'Unknown proposed field' using errcode = '22000';
      end if;
      proposed_value := request_row.proposed_changes->field_name;
      if jsonb_typeof(proposed_value) is distinct from
        (case when field_name = 'registrationRequired' then 'boolean' else 'string' end) then
        raise exception 'Invalid proposed value type' using errcode = '22000';
      end if;
      decisions := decisions || jsonb_build_array(jsonb_build_object(
        'field', field_name, 'decision', entry->>'decision', 'note', note));
      if entry->>'decision' = 'approved' then
        accepted := accepted + 1;
        if field_name <> 'registrationRequired' then
          proposed_value := to_jsonb(nullif(btrim(request_row.proposed_changes->>field_name), ''));
        end if;
        patch := patch || jsonb_build_object(column_name, proposed_value);
      end if;
    end loop;
    if cardinality(seen) <> (select count(*) from jsonb_object_keys(request_row.proposed_changes)) then
      raise exception 'Choose one decision for every proposed field' using errcode = '22000';
    end if;
    outcome := case when accepted = 0 then 'rejected'
      when accepted = cardinality(seen) then 'approved' else 'partially_approved' end;
    note := null;
    if accepted > 0 then
      -- Casts reject invalid dates/non-integer attendance. Validate the whole result:
      -- accepting only one of two proposed dates must not create an invalid interval.
      candidate := jsonb_populate_record(event_row, patch);
      if nullif(btrim(candidate.purpose), '') is null
        or candidate.proposed_start is null or candidate.proposed_end is null
        or not isfinite(candidate.proposed_start) or not isfinite(candidate.proposed_end)
        or candidate.proposed_end <= candidate.proposed_start
        or candidate.expected_attendance is null or candidate.expected_attendance < 1 then
        raise exception 'Accepted changes would leave invalid event details' using errcode = '22000';
      end if;
      update public.events set
        name=candidate.name, purpose=candidate.purpose, event_type=candidate.event_type,
        description=candidate.description, proposed_start=candidate.proposed_start,
        proposed_end=candidate.proposed_end, expected_attendance=candidate.expected_attendance,
        programme=candidate.programme, layout_preference=candidate.layout_preference,
        accessibility_requirements=candidate.accessibility_requirements,
        equipment_requirements=candidate.equipment_requirements,
        registration_required=candidate.registration_required,
        special_arrangements=candidate.special_arrangements
      where id=event_row.id;
    end if;
  else
    raise exception 'Choose a valid review action' using errcode = '22000';
  end if;

  update public.event_change_requests set status=outcome, field_decisions=decisions,
    review_note=note, reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_request_id;
  return outcome;
end $$;
revoke all on function public.review_event_change_request(uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.review_event_change_request(uuid,timestamptz,jsonb) to authenticated;

commit;
