-- 0009_review_decisions.sql — US4 (SCRUM-9) AC-004.4 and AC-004.5.
-- Run after 0008. Additive only: no existing table, policy or trigger is changed.
--
-- AC-004.5 asks for a record of the decision, the reason and who made it to be retained.
-- 0004 already stamps reviewed_by / reviewed_at / review_note on the event row, but those
-- columns hold only the LATEST decision: a return followed by an approval overwrites the
-- return's reason. A retained record therefore needs its own append-only table.
--
-- AC-004.4 asks for an email to the organiser. A database cannot send email, and a
-- browser must never hold an email provider's key, so the decision trigger writes an
-- outbox row in the same transaction and an Edge Function sends it
-- (supabase/functions/send-review-notifications). The outbox is what makes the email
-- reliable: if the decision commits, the email is queued; if it rolls back, nothing is.

begin;

-- ---------------------------------------------------------------------------
-- Decision log (AC-004.5)
-- ---------------------------------------------------------------------------
create table if not exists public.event_review_decisions (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  from_status      text not null,
  -- 'returned' is under_review -> submitted. Stored as a decision word rather than the raw
  -- status, because "submitted" would read as the organiser's action, not the reviewer's.
  decision         text not null,
  reason           text,
  decided_by       uuid not null references public.profiles (id),
  -- A snapshot, not a join: the audit record should say who decided at the time, even if
  -- the profile is later renamed.
  decided_by_name  text not null,
  decided_at       timestamptz not null default now(),
  constraint event_review_decisions_decision_valid
    check (decision in ('approved', 'rejected', 'returned')),
  -- Mirrors require_event_review_reason in 0005: a rejection or return always has a reason.
  constraint event_review_decisions_reason_required
    check (decision = 'approved' or nullif(btrim(reason), '') is not null)
);

create index if not exists event_review_decisions_event_idx
  on public.event_review_decisions (event_id, decided_at desc);

alter table public.event_review_decisions enable row level security;

-- Reviewer identity is internal (0005 hides reviewed_by from organisers for the same
-- reason), so the log is readable by coordinators and operations managers only. The
-- organiser already sees the current outcome and reason on the event itself (US3).
drop policy if exists review_decisions_select_for_staff on public.event_review_decisions;
create policy review_decisions_select_for_staff on public.event_review_decisions
  for select to authenticated
  using (public.current_user_role() in ('coordinator', 'operations_manager'));

-- Append-only. There are no insert, update or delete policies, and the privileges are
-- revoked as well: RLS is the control, the revoke means a future permissive policy added
-- by mistake still cannot open a write path. Only the trigger below writes, as owner.
revoke all on public.event_review_decisions from public, anon, authenticated;
grant select on public.event_review_decisions to authenticated;

-- ---------------------------------------------------------------------------
-- Email outbox (AC-004.4)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_outbox (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  decision_id      uuid references public.event_review_decisions (id) on delete set null,
  recipient_email  text not null,
  subject          text not null,
  body             text not null,
  status           text not null default 'pending',
  attempts         integer not null default 0,
  last_error       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  constraint notification_outbox_status_valid check (status in ('pending', 'sent', 'failed'))
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (created_at) where status = 'pending';

-- No browser role touches the outbox: it holds email addresses, and only the Edge
-- Function (service role, which bypasses RLS) reads or updates it.
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The trigger that writes both
-- ---------------------------------------------------------------------------
-- AFTER UPDATE, so it runs only once every BEFORE trigger (transition rules, reason
-- requirement, review stamp) has accepted the change. A refused transition therefore never
-- produces a record or an email.
--
-- SECURITY DEFINER because the caller has no insert privilege on either table, and must
-- not: who decided comes from auth.uid() here, never from anything the browser sends.
create or replace function public.record_event_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_word  text;
  actor_name     text;
  organiser_email text;
  new_decision_id uuid;
  event_label    text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  decision_word := case
    when new.status = 'approved' then 'approved'
    when new.status = 'rejected' then 'rejected'
    when old.status = 'under_review' and new.status = 'submitted' then 'returned'
    else null
  end;

  -- Starting a review, lifecycle moves and administrator fixes (no JWT) are not review
  -- decisions. An admin correction in the SQL editor has no actor to attribute.
  if decision_word is null or auth.uid() is null then
    return null;
  end if;

  select full_name into actor_name from public.profiles where id = auth.uid();

  insert into public.event_review_decisions
    (event_id, from_status, decision, reason, decided_by, decided_by_name)
  values
    (new.id, old.status, decision_word, nullif(btrim(new.review_note), ''),
     auth.uid(), coalesce(actor_name, 'Unknown reviewer'))
  returning id into new_decision_id;

  -- AC-004.4 names the approved/rejected outcomes. A return is logged above but not
  -- emailed; widening this is one line if the team decides organisers should be told.
  if decision_word in ('approved', 'rejected') then
    select email into organiser_email from auth.users where id = new.organiser_id;

    -- An account with no email (a phone sign-up) cannot be notified; the decision itself
    -- must not fail because of that.
    if organiser_email is not null then
      event_label := coalesce(new.reference, 'your event request')
        || coalesce(' (' || nullif(btrim(new.name), '') || ')', '');

      insert into public.notification_outbox
        (event_id, decision_id, recipient_email, subject, body)
      values (
        new.id,
        new_decision_id,
        organiser_email,
        'Your event request ' || coalesce(new.reference, '') || ' was ' || decision_word,
        'Your event request ' || event_label || ' has been ' || decision_word
          || ' by an event coordinator.' || E'\n\n'
          || 'Reason: ' || coalesce(nullif(btrim(new.review_note), ''), 'No reason was given.')
          || E'\n\n' || 'You can view the current status of your request in ConnectSphere.'
      );
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.record_event_review_decision() from public, anon, authenticated;

drop trigger if exists events_record_review_decision on public.events;
create trigger events_record_review_decision
  after update on public.events
  for each row execute function public.record_event_review_decision();

commit;
