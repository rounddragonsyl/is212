-- US7 AC1: delivery records for assigned coordinators. No live email is enabled here.
-- Reuses the existing notification_outbox sender; does not change US4 email behavior.
begin;
create table if not exists public.change_request_notification_settings (
  notification_type text primary key check (notification_type='change_request_submitted'),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false
);
insert into public.change_request_notification_settings(notification_type)
 values ('change_request_submitted') on conflict do nothing;
alter table public.change_request_notification_settings enable row level security;
revoke all on public.change_request_notification_settings from public, anon, authenticated;

create table if not exists public.change_request_notifications (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.event_change_requests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id),
  request_version integer not null,
  in_app_enabled boolean not null,
  email_outbox_id uuid references public.notification_outbox(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(change_request_id,request_version,recipient_id)
);
create index if not exists change_request_notifications_recipient_idx
 on public.change_request_notifications(recipient_id,created_at desc);
alter table public.change_request_notifications enable row level security;
revoke all on public.change_request_notifications from public, anon, authenticated;
grant select on public.change_request_notifications to authenticated;
drop policy if exists coordinator_read_own_change_notifications on public.change_request_notifications;
create policy coordinator_read_own_change_notifications on public.change_request_notifications
 for select to authenticated using (
  recipient_id=auth.uid() and in_app_enabled and public.current_user_role()='coordinator'
  and exists(select 1 from public.events e where e.id=change_request_notifications.event_id and e.coordinator_id=auth.uid())
 );

create or replace function public.notify_change_request_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  settings public.change_request_notification_settings%rowtype;
  coordinator uuid;
  recipient_email text;
  notification_id uuid;
  outbox_id uuid;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op='UPDATE' then
    if old.status <> 'clarification_requested' then return new; end if;
  end if;
  select * into settings from public.change_request_notification_settings
    where notification_type='change_request_submitted';
  if not found or not (settings.in_app_enabled or settings.email_enabled) then return new; end if;
  select e.coordinator_id into coordinator from public.events e
    join public.profiles p on p.id=e.coordinator_id and p.role='coordinator'
    where e.id=new.event_id;
  -- Assignment is owned by US17. Never broadcast an unassigned request to all staff.
  if coordinator is null then return new; end if;
  insert into public.change_request_notifications
    (change_request_id,event_id,recipient_id,request_version,in_app_enabled)
    values(new.id,new.event_id,coordinator,new.review_version,settings.in_app_enabled)
    on conflict(change_request_id,request_version,recipient_id) do nothing
    returning id into notification_id;
  if notification_id is null then return new; end if;
  if settings.email_enabled then
    select email into recipient_email from auth.users where id=coordinator;
    if nullif(btrim(recipient_email),'') is not null then
      -- Generic body does not disclose event details if assignment changes before delivery.
      insert into public.notification_outbox(event_id,recipient_email,subject,body)
        values(new.event_id,recipient_email,'An event change request is ready for review',
          'A change request was submitted or clarification answers were received for an event assigned to you. Sign in to ConnectSphere and open Requests to review the requests currently assigned to you.')
        returning id into outbox_id;
      update public.change_request_notifications set email_outbox_id=outbox_id where id=notification_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.notify_change_request_submission() from public, anon, authenticated;
drop trigger if exists event_change_requests_notify_submission on public.event_change_requests;
create trigger event_change_requests_notify_submission after insert or update on public.event_change_requests
 for each row execute function public.notify_change_request_submission();
commit;
