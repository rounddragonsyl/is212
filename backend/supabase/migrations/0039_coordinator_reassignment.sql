-- US17 slice 2: preserve coordinator responsibility once an event has ended.
begin;

create or replace function public.guard_event_coordinator_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.coordinator_id is not distinct from old.coordinator_id then return new; end if;
  elsif new.coordinator_id is null then
    return new;
  end if;
  if auth.uid() is not null and public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may assign a coordinator' using errcode = '42501';
  end if;
  if new.status = 'draft' then
    raise exception 'Submit the event before assigning a coordinator' using errcode = '22000';
  end if;
  -- Check both row versions so changing status in the same write cannot bypass the rule.
  -- The trigger protects the assignment RPC and direct database writes alike.
  if tg_op = 'UPDATE' then
    if old.status in ('completed', 'cancelled') or new.status in ('completed', 'cancelled') then
      raise exception 'Completed or cancelled events cannot be reassigned' using errcode = '22000';
    end if;
  end if;
  if new.coordinator_id is not null and not exists (
    select 1 from public.profiles where id = new.coordinator_id and role = 'coordinator'
  ) then
    raise exception 'Choose a coordinator profile' using errcode = '22000';
  end if;
  return new;
end $$;

commit;
