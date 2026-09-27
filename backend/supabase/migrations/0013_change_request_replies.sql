-- Organiser replies to US7 clarification. Depends on 0011; 0012 (US4 direct
-- review) is reserved in a separate PR and is not required by this migration.
begin;
alter table public.event_change_requests add column if not exists review_version integer not null default 0;
alter table public.event_change_requests add column if not exists reply_history jsonb not null default '[]';
grant select (review_version, reply_history) on public.event_change_requests to authenticated;

-- Only database updates increment the version; clients cannot supply their own.
create or replace function public.bump_change_request_version()
returns trigger language plpgsql set search_path='' as $$
begin
  new.review_version := old.review_version + 1;
  return new;
end $$;
drop trigger if exists event_change_requests_bump_version on public.event_change_requests;
create trigger event_change_requests_bump_version before update on public.event_change_requests
for each row execute function public.bump_change_request_version();

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
  needs_clarification boolean := false;
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
  -- Old clients may finish first-round reviews, but must reload before reviewing
  -- any request that has been answered. A new client always sends its snapshot version.
  if p_review ? 'requestVersion' then
    if jsonb_typeof(p_review->'requestVersion') is distinct from 'number'
      or (p_review->>'requestVersion')::numeric <> request_row.review_version then
      raise exception 'Request changed; reload before reviewing' using errcode='22000';
    end if;
  elsif jsonb_array_length(request_row.reply_history) > 0 then
    raise exception 'Request changed; reload before reviewing' using errcode='22000';
  end if;
  p_review := p_review - 'requestVersion';
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
        or (entry->>'decision') not in ('approved','rejected','clarification_requested')
        or (entry ? 'note' and jsonb_typeof(entry->'note') <> 'string') then
        raise exception 'Choose one decision for every proposed field' using errcode = '22000';
      end if;
      seen := array_append(seen, field_name);
      note := btrim(coalesce(entry->>'note', ''));
      if entry->>'decision' = 'rejected' and note = '' then
        raise exception 'Explain each rejected change' using errcode = '22000';
      end if;
      if entry->>'decision' = 'clarification_requested' then
        if note = '' then
          raise exception 'Explain what the organiser needs to clarify' using errcode = '22000';
        end if;
        needs_clarification := true;
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
    outcome := case when needs_clarification then 'clarification_requested'
      when accepted = 0 then 'rejected'
      when accepted = cardinality(seen) then 'approved' else 'partially_approved' end;
    note := null;
    -- Mixed decisions are provisional while any field needs clarification. Persist
    -- the whole checklist below, but leave event values AND updated_at untouched.
    if accepted > 0 and not needs_clarification then
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

create or replace function public.reply_to_change_request(
  p_request_id uuid, p_request_version integer, p_reply jsonb
) returns text language plpgsql security definer set search_path='' as $$
declare
  request_row public.event_change_requests%rowtype;
  event_row public.events%rowtype;
  question jsonb;
  answer jsonb;
  answers jsonb := '[]';
  prepared jsonb;
  fields text[] := '{}';
  field_name text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'organiser' then
    raise exception 'Only the owning organiser may reply' using errcode='42501';
  end if;
  select * into request_row from public.event_change_requests where id=p_request_id;
  if not found or request_row.organiser_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode='42501';
  end if;
  -- Match review lock order, so replies and decisions cannot overtake each other.
  select * into event_row from public.events where id=request_row.event_id for update;
  if not found or event_row.organiser_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode='42501';
  end if;
  select * into request_row from public.event_change_requests where id=p_request_id for update;
  if request_row.status <> 'clarification_requested'
    or p_request_version is null or p_request_version <> request_row.review_version then
    raise exception 'Request changed; reload before replying' using errcode='22000';
  end if;
  if event_row.status not in ('submitted','under_review','approved','planning','confirmed') then
    raise exception 'This event can no longer be changed' using errcode='22000';
  end if;
  if exists (select 1 from public.event_change_requests
    where event_id=event_row.id and id<>p_request_id and status='submitted') then
    raise exception 'Another change request is already awaiting review' using errcode='23505';
  end if;
  if jsonb_typeof(p_reply) is distinct from 'object' then
    raise exception 'Invalid reply' using errcode='22000';
  end if;
  if coalesce(request_row.field_decisions,'[]'::jsonb) = '[]'::jsonb then
    if nullif(btrim(request_row.review_note),'') is null
      or p_reply - 'note' <> '{}'::jsonb
      or jsonb_typeof(p_reply->'note') is distinct from 'string'
      or nullif(btrim(p_reply->>'note'),'') is null then
      raise exception 'Answer the clarification question' using errcode='22000';
    end if;
    prepared := jsonb_build_object('note',btrim(p_reply->>'note'));
  else
    if jsonb_typeof(request_row.field_decisions) is distinct from 'array'
      or p_reply - 'replies' <> '{}'::jsonb
      or jsonb_typeof(p_reply->'replies') is distinct from 'array' then
      raise exception 'Invalid field replies' using errcode='22000';
    end if;
    for question in select value from jsonb_array_elements(request_row.field_decisions) loop
      if question->>'decision' = 'clarification_requested' then
        field_name := question->>'field';
        if field_name is null or field_name=any(fields)
          or not request_row.proposed_changes ? field_name
          or nullif(btrim(question->>'note'),'') is null then
          raise exception 'Invalid clarification questions' using errcode='22000';
        end if;
        fields := array_append(fields,field_name);
        if (select count(*) from jsonb_array_elements(p_reply->'replies') a where a->>'field'=field_name) <> 1 then
          raise exception 'Answer every question once' using errcode='22000';
        end if;
        select value into answer from jsonb_array_elements(p_reply->'replies') where value->>'field'=field_name;
        if jsonb_typeof(answer) is distinct from 'object'
          or answer - array['field','message'] <> '{}'::jsonb
          or jsonb_typeof(answer->'message') is distinct from 'string'
          or nullif(btrim(answer->>'message'),'') is null then
          raise exception 'Provide text answers only' using errcode='22000';
        end if;
        answers := answers || jsonb_build_array(jsonb_build_object('field',field_name,'message',btrim(answer->>'message')));
      end if;
    end loop;
    if cardinality(fields)=0 or jsonb_array_length(p_reply->'replies') <> cardinality(fields) then
      raise exception 'Answer every question once' using errcode='22000';
    end if;
    prepared := jsonb_build_object('replies',answers);
  end if;
  update public.event_change_requests set
    reply_history=reply_history || jsonb_build_array(jsonb_build_object(
      'requestVersion',request_row.review_version,
      'fieldDecisions',request_row.field_decisions,'reviewNote',request_row.review_note,
      'reviewedBy',request_row.reviewed_by,'reviewedAt',request_row.reviewed_at,
      'reply',prepared,'repliedBy',auth.uid(),'repliedAt',clock_timestamp())),
    status='submitted'
    where id=p_request_id;
  return 'submitted';
end $$;
revoke all on function public.reply_to_change_request(uuid,integer,jsonb) from public, anon;
grant execute on function public.reply_to_change_request(uuid,integer,jsonb) to authenticated;
commit;
