-- 0004_review.sql — coordinator review: write access, guarded status transitions,
-- and a tightening of two function grants.
--
-- 0003 let a coordinator READ every event. Reviewing one means changing its status, which
-- needs an update policy — and a guard, because "status is a text column an authorised
-- user may set to anything" would let a coordinator move a rejected event straight to
-- completed, or an organiser approve their own request.

-- ---------------------------------------------------------------------------
-- Tightening 0003's grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so the explicit grants
-- in 0003 were redundant and both functions were callable anonymously. dev_set_my_role
-- refuses an anonymous caller in its body, but an in-function guard is the weaker control:
-- revoking the privilege means the call never reaches the body at all.
revoke execute on function public.current_user_role() from public;
revoke execute on function public.dev_set_my_role(text) from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.dev_set_my_role(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Which status may follow which
-- ---------------------------------------------------------------------------
-- The workflow as a function rather than a CHECK constraint, because a CHECK sees only the
-- new row and a transition is a statement about the pair (old, new).
--
-- Terminal states — completed, cancelled, rejected — deliberately have no successor. An
-- event that needs to come back from one of those is a new request, which keeps the audit
-- trail honest.
create or replace function public.is_valid_status_transition(old_status text, new_status text)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'draft'      then new_status in ('submitted', 'cancelled')
    when 'submitted'  then new_status in ('under_review', 'cancelled')
    -- under_review can return to submitted: a coordinator asking the organiser for more
    -- detail is a normal outcome of review, not a rejection.
    when 'under_review' then new_status in ('approved', 'rejected', 'submitted', 'cancelled')
    when 'approved'   then new_status in ('planning', 'cancelled')
    when 'planning'   then new_status in ('confirmed', 'cancelled')
    when 'confirmed'  then new_status in ('completed', 'cancelled')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Who may perform which transition
-- ---------------------------------------------------------------------------
-- Role AND relationship, the pair core feature #1 asks for: being a coordinator is not
-- enough to submit someone's draft, and owning an event is not enough to approve it.
create or replace function public.enforce_event_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- No JWT means the SQL editor or a service key: an administrator fixing data, which we
  -- do not stand in the way of.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_valid_status_transition(old.status, new.status) then
    raise exception 'An event cannot move from % to %', old.status, new.status
      using errcode = '22000';
  end if;

  actor_role := public.current_user_role();

  if actor_role = 'coordinator' then
    -- A coordinator reviews, but does not file requests on an organiser's behalf.
    if new.status = 'submitted' and old.status = 'draft' then
      raise exception 'Only the organiser may submit their own request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.organiser_id = auth.uid() then
    -- The organiser submits and may withdraw. Approval is not theirs to grant, which is
    -- the whole point of having a review step.
    if new.status not in ('submitted', 'cancelled') then
      raise exception 'An organiser cannot move their own request to %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'You are not permitted to change the status of this event'
    using errcode = '42501';
end;
$$;

drop trigger if exists events_enforce_status_transition on public.events;
create trigger events_enforce_status_transition
  before update on public.events
  for each row execute function public.enforce_event_status_transition();

-- ---------------------------------------------------------------------------
-- Coordinator write access
-- ---------------------------------------------------------------------------
-- The policy decides whether a coordinator may touch the row at all; the trigger above
-- decides whether the particular change is legal. Policy for reach, trigger for workflow.
drop policy if exists events_update_for_coordinators on public.events;
create policy events_update_for_coordinators on public.events
  for update to authenticated
  using (public.current_user_role() = 'coordinator')
  with check (public.current_user_role() = 'coordinator');

-- ---------------------------------------------------------------------------
-- Review bookkeeping
-- ---------------------------------------------------------------------------
-- Who decided, when, and why — a rejection with no reason is not a review.
alter table public.events add column if not exists reviewed_by uuid references public.profiles (id);
alter table public.events add column if not exists reviewed_at timestamptz;
alter table public.events add column if not exists review_note text;

create or replace function public.stamp_event_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('under_review', 'approved', 'rejected')
     and auth.uid() is not null then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists events_stamp_review on public.events;
create trigger events_stamp_review
  before update on public.events
  for each row execute function public.stamp_event_review();
