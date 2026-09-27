# US7 arrangement revalidation hook — 27 September

## Scope and contract

SCRUM-59 / AC12 permits a hook while the venue/equipment features are unfinished.
Migration 0015 adds event_change_revalidations and an AFTER UPDATE trigger on
 event_change_requests. A final approved/partially_approved review creates one row only
when at least one accepted proposal field is significant. The existing review RPC is
unchanged. A trigger failure rolls back its event update and request decision together.

This is pending work for downstream features, not completed availability checking.
No booking is cancelled/rebooked, no event moves to Planning, and no worker or completion
endpoint is included. Existing approvals are not backfilled. The next owners must connect
actual checks and define completion state/permissions in a later migration; browsers may
only read authorised rows now.

| Accepted field | Venue check | Equipment check |
| --- | --- | --- |
| proposedStart / proposedEnd | Yes | Yes |
| expectedAttendance | Yes | Yes |
| layoutPreference / accessibilityRequirements | Yes | No |
| equipmentRequirements | No | Yes |

Attendance conservatively flags both because capacity and equipment quantities may depend
on it; this is an implementation mapping for team review. A pending flag does not assert
that a booking is unsuitable or unavailable. Clearing an optional requirement also counts.
The database derives this mapping from stored accepted decisions, never a browser flag.

Each row has change_request_id (primary key), event_id, approved_fields (accepted significant
fields only), venue_required, equipment_required, status='pending', created_by and created_at.
The assigned coordinator and Operations Manager can read it; organisers and unrelated
coordinators cannot. No browser INSERT/UPDATE/DELETE grants. The unique request key and
existing final-review status guard prevent duplicate work.

## Changed files

- backend/supabase/migrations/0015_change_request_revalidation.sql: table, index, RLS/read permissions,
  protected trigger function and trigger. Replaying the migration preserves existing rows.
- backend/supabase/tests/change_request_revalidation.sql: actual review RPC calls under authenticated
  roles, with synthetic fixtures in the disposable local database only.
- backend/supabase/tests/run_change_request_review.sh: runs these checks and migration replay.
- README.md / CLAUDE.md: integration contract and remaining work.

No application code changes in this hook step. The AC11 classification label was merged separately before this hook was restored.

## New tests

All are database checks, not mocked Vitest cases.

| ID | Check |
| --- | --- |
| AC-007.12.1 | Submission alone does not queue work. |
| AC-007.12.2 | Ordinary approval does not queue work. |
| AC-007.12.3 | Rejected significant request does not queue work. |
| AC-007.12.4 | Partial approval of ordinary fields does not queue rejected significant fields. |
| AC-007.12.5 | Provisional approval with clarification does not queue work. |
| AC-007.12.6 | Removing equipment requirements queues equipment only, with actor/time. |
| AC-007.12.7 | Layout/accessibility queue venue only. |
| AC-007.12.8 | Attendance queues both. |
| AC-007.12.9 | Start/end changes queue both. |
| AC-007.12.10 | Unassigned coordinator cannot read the queue. |
| AC-007.12.11 | Organiser cannot read the internal queue. |
| AC-007.12.12 | Operations Manager can read it. |
| AC-007.12.13 | Browser cannot directly update it. |
| AC-007.12.14 | Queue failure fails the approval operation. |
| AC-007.12.15 | Failure rolls back event, request and queue. |
| AC-007.12.16 | Hook does not change event lifecycle status. |
| AC-007.12.17 | Partial approval queues only accepted significant fields. |
| AC-007.12.18 | Retrying a final review cannot create duplicate work. |
| AC-007.12.19 | Replaying migration preserves records (in the runner). |

Verification: all **114 database checks passed**, including these 19 new cases.
The last application run passed 368 tests; no application code changed in this hook step.

## Deployment and manual check

Jaydon reported applying 0015 to shared Supabase on 27 September and verified that
approving an equipment change request creates a pending revalidation record. This is
user-reported live evidence for that path; the remaining cases have local SQL coverage.
For another environment, review and apply the existing migrations through 0015 first.
It adds a new table and recreates its own policy/trigger, without deleting event data.
After deployment, approve a NEW equipment change request for a test event, then inspect
public.event_change_revalidations in Supabase: expect one pending row with equipment_required
true and venue_required false. Approval of an ordinary-only change or rejection must not
create a row. An approved attendance change should flag both. Do not run SQL test fixtures
on shared Supabase. Full RLS/rollback checks run via the disposable Docker runner.

The classification display is already merged. This hook is the next separate commit;
README/CLAUDE also restore the saved classification notes.
US7 still needs coordinator submission notifications and full retained review activity history.

Restored after the frontend/backend restructure. The unapplied migration was renamed
from 0014 to 0015 because main now uses 0014 for removing the development role switcher.
No applied migration was renumbered. The original stash remains intact as a backup.
