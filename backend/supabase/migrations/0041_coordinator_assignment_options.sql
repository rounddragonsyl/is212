-- US17 slice 3: a narrow read operation for the Lead's coordinator dropdown.
-- 0041 was claimed for this work through the team's migration-number process.
begin;

create or replace function public.list_assignment_coordinators()
returns table (coordinator_id uuid, full_name text, active_event_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may list assignment options' using errcode = '42501';
  end if;

  -- Do not broaden profiles RLS: expose only the coordinator identity and workload.
  -- Counts guide selection; they neither impose a limit nor reserve capacity.
  return query
    select p.id, p.full_name, count(e.id)
    from public.profiles p
    left join public.events e on e.coordinator_id = p.id
      and e.status in ('submitted', 'under_review', 'approved', 'planning', 'confirmed')
    where p.role = 'coordinator'
    group by p.id, p.full_name
    order by lower(p.full_name), p.id;
end $$;

revoke all on function public.list_assignment_coordinators() from public, anon, authenticated;
grant execute on function public.list_assignment_coordinators() to authenticated;

commit;
