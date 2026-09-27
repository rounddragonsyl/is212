-- US7 AC13: retained review actions, separate from US4 initial-request history.
-- Captures future decisions only; do not invent unavailable historical actions.
begin;
create table if not exists public.event_change_review_history (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.event_change_requests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  request_version integer not null,
  outcome text not null check (outcome in ('approved','rejected','partially_approved','clarification_requested')),
  proposed_changes jsonb not null,
  field_decisions jsonb not null,
  review_note text,
  reviewed_by uuid not null references public.profiles(id),
  reviewer_name text not null,
  reviewed_at timestamptz not null,
  unique(change_request_id,request_version)
);
create index if not exists event_change_review_history_request_idx
 on public.event_change_review_history(change_request_id,request_version desc);
alter table public.event_change_review_history enable row level security;
revoke all on public.event_change_review_history from public, anon, authenticated;
grant select on public.event_change_review_history to authenticated;
drop policy if exists staff_read_change_review_history on public.event_change_review_history;
create policy staff_read_change_review_history on public.event_change_review_history
 for select to authenticated using (
  public.current_user_role()='operations_manager'
  or (public.current_user_role()='coordinator' and exists (
    select 1 from public.events e where e.id=event_change_review_history.event_id and e.coordinator_id=auth.uid()
  ))
 );
create or replace function public.record_change_request_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  actor_name text;
begin
  if old.status <> 'submitted'
    or new.status not in ('approved','rejected','partially_approved','clarification_requested')
    or auth.uid() is null then return new; end if;
  -- The review RPC sets actor/time, and browser column grants forbid spoofing them.
  -- Do not record an administrator's direct SQL fix as a coordinator review.
  if new.reviewed_by is distinct from auth.uid() or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Invalid review history actor' using errcode='42501';
  end if;
  select full_name into actor_name from public.profiles where id=new.reviewed_by;
  insert into public.event_change_review_history(change_request_id,event_id,request_version,
    outcome,proposed_changes,field_decisions,review_note,reviewed_by,reviewer_name,reviewed_at)
  values(new.id,new.event_id,new.review_version,new.status,new.proposed_changes,
    coalesce(new.field_decisions,'[]'::jsonb),new.review_note,new.reviewed_by,
    coalesce(actor_name,'Unknown reviewer'),new.reviewed_at);
  return new;
end $$;
revoke all on function public.record_change_request_review() from public, anon, authenticated;
drop trigger if exists event_change_requests_record_review on public.event_change_requests;
create trigger event_change_requests_record_review after update on public.event_change_requests
 for each row execute function public.record_change_request_review();
commit;
