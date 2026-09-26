-- Remove the user-visible Start review step while preserving US4's existing
-- transition guards, reason requirements, decision history and email trigger.
begin;
create or replace function public.review_submitted_event(
  p_event_id uuid, p_decision text, p_note text default null
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  current_status text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only a coordinator may review an event request' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected','submitted') then
    raise exception 'Choose approval, rejection or return for clarification' using errcode='22000';
  end if;
  if p_decision in ('rejected','submitted') and nullif(btrim(p_note),'') is null then
    raise exception 'Give a reason when returning or rejecting a request' using errcode='22000';
  end if;
  select status into current_status from public.events where id=p_event_id for update;
  if not found or current_status <> 'submitted' then
    raise exception 'Request changed; reload before reviewing' using errcode='22000';
  end if;
  -- Both updates commit together. An error rolls back the intermediate status too.
  update public.events set status='under_review', review_note=null where id=p_event_id;
  update public.events set status=p_decision, review_note=nullif(btrim(p_note),'') where id=p_event_id;
  return p_decision;
end $$;
revoke all on function public.review_submitted_event(uuid,text,text) from public, anon;
grant execute on function public.review_submitted_event(uuid,text,text) to authenticated;
commit;
