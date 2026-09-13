-- SCRUM-24: ownership applies to draft and submitted requests alike.
drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated
  using (organiser_id = auth.uid() and public.current_user_role() = 'organiser');

-- Drafts are private working copies, including when accessed by URL.
drop policy if exists events_select_for_coordinators on public.events;
create policy events_select_for_coordinators on public.events
  for select to authenticated
  using (public.current_user_role() = 'coordinator' and status <> 'draft');

-- A frontend projection alone cannot protect internal reviewer identity. Explicit
-- column grants also ensure future internal columns are not exposed automatically.
revoke select on public.events from public, anon, authenticated;
revoke select (reviewed_by) on public.events from public, anon, authenticated;
grant select (
  id, reference, organiser_id, name, purpose, event_type, description,
  proposed_start, proposed_end, expected_attendance, programme, layout_preference,
  accessibility_requirements, equipment_requirements, registration_required,
  special_arrangements, status, created_at, updated_at, submitted_at,
  review_note, reviewed_at
) on public.events to authenticated;

-- Preserve the existing return-to-submitted workflow; a shared reason is required
-- even when the coordinator uses the API directly.
create or replace function public.require_event_review_reason()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and (new.status = 'rejected'
       or (old.status = 'under_review' and new.status = 'submitted'))
     and nullif(btrim(new.review_note), '') is null then
    raise exception 'Give a reason when returning or rejecting a request'
      using errcode = '22000';
  end if;
  return new;
end;
$$;
drop trigger if exists events_require_review_reason on public.events;
create trigger events_require_review_reason before update on public.events
  for each row execute function public.require_event_review_reason();
