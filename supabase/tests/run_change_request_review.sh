#!/usr/bin/env bash
set -euo pipefail

# Never targets a configured Supabase project: no .env, ports or host volumes.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-review-test-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null

ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Temporary database did not become ready.' >&2; exit 1; fi

{
  cat "$repo_root/supabase/tests/bootstrap.sql"
  for migration in "$repo_root"/supabase/migrations/*.sql; do cat "$migration"; printf '\n'; done
  cat "$repo_root/supabase/tests/change_request_review.sql"
  cat "$repo_root/supabase/migrations/0008_change_request_review.sql"
  # Replay later replacements too: replaying 0008 alone would restore an old RPC.
  cat "$repo_root/supabase/migrations/0010_change_request_field_clarification.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from requests_before_repeat)
    union all (select * from requests_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.3: rerunning migration preserves saved review decisions');
SQL
  cat "$repo_root/supabase/tests/change_request_field_clarification.sql"
  cat "$repo_root/supabase/migrations/0010_change_request_field_clarification.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from field_reviews_before_repeat)
    union all (select * from field_reviews_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.5: rerunning field clarification migration preserves existing and provisional decisions');
SQL
  # Reproduce the shared table's differently named legacy constraint. NOT VALID
  # allows existing reviewed fixtures but still rejects new updates to these states.
  cat <<'SQL'
alter table public.event_change_requests add constraint event_change_requests_status_valid
  check (status in ('submitted','approved','rejected','withdrawn')) not valid;
do $$ begin
  begin
    update public.event_change_requests set status='clarification_requested'
      where id='20000000-0000-0000-0000-000000000001';
  exception when check_violation then return;
  end;
  raise exception 'Legacy constraint fixture did not reproduce the failure';
end $$;
SQL
  cat "$repo_root/supabase/migrations/0011_change_request_legacy_status_constraint.sql"
  cat "$repo_root/supabase/migrations/0011_change_request_legacy_status_constraint.sql"
  cat "$repo_root/supabase/tests/change_request_legacy_status_constraint.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
