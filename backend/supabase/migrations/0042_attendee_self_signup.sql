-- 0042_attendee_self_signup.sql — US29 (SCRUM-227): self sign-up creates Attendees.
--
-- 0005 made the database create each profile together with the account, as 'organiser'. US29
-- turns self sign-up into Attendee sign-up: AC-029.3 says it must never grant an internal role
-- or the Event Organiser role. Organiser and staff accounts are provisioned by the team as
-- seed data (Jira card assumption, customer thread #53); an administrator then sets the role
-- from the SQL editor, which prevent_role_self_assignment (0003) allows.
--
-- 0005 is not edited, so a database that has applied it keeps its history; this migration
-- only replaces the function. Safe to re-run, and it changes no existing profile
-- (AC-029.3.13): accounts created before it keep the role they already have.

-- raw_user_meta_data is whatever the browser sent with supabase.auth.signUp, so anyone can put
-- anything in it with dev tools. It is read for one thing only, a display name. The role is a
-- constant here, so no value in the metadata can change it (AC-029.3).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, public.default_full_name(new.raw_user_meta_data, new.email), 'attendee');
  return new;
end;
$$;

-- As in 0005: a trigger function, not an API. on_auth_user_created (0005) already calls it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
