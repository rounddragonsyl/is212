> **Current Slice 1 result:** see [us10-slice1.md](us10-slice1.md) for scope,
> commit pairs and screenshot commands. The chronological record below includes
> superseded checkpoints; labelled observed outputs are in [us10-evidence](us10-evidence/).
>
> **Updated 2026-10-06 after syncing to main f854749.** The original record below
> is historical: its eight mocked tests and results are not current RED evidence.

## GREEN checkpoint (2026-10-06)

RED commit: `74d9307`. Tests and assertions are unchanged from that commit.
Production change: `backend/supabase/migrations/0037_venue_booking_rejection_reason.sql`.
Fetched origin/main before allocating 0037; latest main was f854749 with migrations
through 0036. Recheck numbering again before PR integration.

The new CHECK constraint requires a non-null review_note containing at least one
non-whitespace character whenever booking status is rejected. NOT VALID preserves
legacy rows without inventing historical reasons; all new inserts and updates
are checked. Existing invalid rejected rows also need a valid reason if updated.
No frontend implementation or other acceptance criteria were added.

User authorised implementation and both full-suite runs. Assistant-operated local
tools ran these checks; the following is an observed result summary, not a full log:

| Check | Result |
| --- | --- |
| Full frontend suite (`npm.cmd test`, frontend directory, same CI placeholder env/TZ as RED) | 73 files passed; 761 tests passed, 1 existing TODO; exit 0; duration 14.01s |
| Full database runner (Git Bash, disposable Docker PostgreSQL 17) | Completed successfully, exit 0; all four US10 cases PASS |

```text
AC-010.8.9   PASS - missing reason refused
AC-010.8.10  PASS - empty reason refused
AC-010.8.11  PASS - whitespace-only reason refused
AC-010.8.12  PASS - valid reason accepted and recorded

total | passed | failed
    4 |      4 |      0
```

Frontend output also included React act(...) warnings from VenueBlockForm tests;
these were not failures. No production changes were made to those components.

Refactor: none needed for this small constraint. The GREEN commit awaits user
approval. No push, PR, remote CI run, or shared Supabase migration application.
This completes only AC8 database validation, not the entire rejection slice.

## Current first-AC tests (RED verified 2026-10-06)

US10 remains Review Venue Booking Request, as confirmed by the user. Main also
labels tentative-hold tests AC-010. Their IDs are left unchanged. The new cases
use the next unused AC8 suffixes, .9-.12; the semantic story-number collision
still needs team/Jira reconciliation. Do not relabel teammates' tests silently.

- Archived the obsolete frontend file verbatim to `docs/us10-obsolete-tests.txt`.
  It imported releaseVenueBooking, which main removed. The old file is no longer
  in Vitest discovery, so it cannot generate misleading missing-import failures.
- `backend/supabase/tests/venue_booking_review.sql` tests only AC8, against the
  existing database UPDATE path as authenticated Venue Staff. No missing RPC,
  fake production implementation or substitution of coordinator releaseHold.
- AC-010.8.9: null reason; .10: empty; .11: whitespace-only. Expected refusal leaves
  the request pending. .12: positive control verifies a valid reason is stored.
- Verified RED result: three failed assertions and one passing control.
  An RLS/fixture/setup error is not RED.
- Appended the SQL file to the existing full database runner. All existing checks
  run before it, and the new summary lists each case and total/pass/fail counts.
- No production files or migrations changed. Latest migration remains 0036.
- Full frontend and database suites were run before production changes. This
  record and the tests form the local RED commit; no push or PR has been performed.

### Screenshot checkpoint: first RED run

To reproduce the recorded checkpoint, use VS Code Terminal at repository root:

```powershell
git branch --show-current
git rev-parse --short HEAD
cd frontend
$env:TZ = 'Asia/Singapore'
$env:VITE_SUPABASE_URL = 'https://example.supabase.co'
$env:VITE_SUPABASE_ANON_KEY = 'ci-placeholder-anon-key'
npm.cmd test -- --reporter=verbose
cd ..
& 'C:\Program Files\Git\bin\bash.exe' backend/supabase/tests/run_change_request_review.sh
```

Docker must be running and Bash must have Docker access. Capture the full frontend
summary (expected to pass), then the database AC-010.8.9-.12 result table, count
summary, and final assertion failure. This slice's RED evidence is **SQL**, not
Vitest. Do not caption it as four failing frontend tests. Also record any earlier
regression failures separately. The results below were obtained on this base.
After GREEN, rerun the same full suites and capture the same cases passing.

### Recorded RED evidence (2026-10-06)

Branch: `us10/reject-venue-booking`. Production base: `f854749`.
Execution: assistant-operated tools on the local machine, with user approval.
This is a summary and excerpt of observed output, not a saved full raw log.

Full frontend run: `npm.cmd test -- --reporter=verbose` from frontend, with the
placeholder Supabase settings and Asia/Singapore timezone shown above; exit 0:

```text
Test Files  73 passed (73)
Tests       761 passed | 1 todo (762)
Duration    11.65s
```

Full database run: the existing runner with US10 checks appended, executed via
Git Bash against disposable PostgreSQL 17 in Docker. No shared Supabase was used.
All preceding checks completed without an assertion error; the final US10 checks
returned the following results, and the runner exited 1:

| Test ID | Expected behaviour | Observed result |
| --- | --- | --- |
| AC-010.8.9 | Missing reason refused; booking stays pending | FAIL |
| AC-010.8.10 | Empty reason refused; booking stays pending | FAIL |
| AC-010.8.11 | Whitespace-only reason refused; booking stays pending | FAIL |
| AC-010.8.12 | Valid reason accepted and recorded by Venue Staff | PASS |

```text
total | passed | failed
    4 |      1 |      3

ERROR: US10 AC8 assertions failed: rejection reasons must be mandatory
```

Why this is valid RED: the existing database accepts null, empty and whitespace
rejection reasons. The positive control confirms the Venue Staff write path and
fixtures work. Failure is not caused by a missing import or nonexistent RPC.
The earlier Docker-not-running attempt was a setup failure and is not RED evidence.

Next checkpoint: after the RED commit, obtain approval for the minimal production
fix. Rerun both full suites, capture these same four IDs passing, then create a
separate GREEN commit. No implementation has been made in this RED commit.

To find this evidence in Git:

```powershell
git log --oneline --grep="test(us10): record RED rejection-reason checks"
git show <red-commit>:docs/us10-test-first.md
git show --stat <red-commit>
```

---

## Historical first prompt (superseded test plan and results)

# US10 / SCRUM-17: Review Venue Booking Request - test-first record

## Prompt 1: scope and source

- Date: 2026-10-05.
- User request: create a short-lived branch; write tests before implementation;
  follow the supplied red -> green -> refactor image; explain documentation;
  name cases AC-00X.Y.Z.
- Requirements: US10.doc, Jira export updated 2026-10-04, SCRUM-17,
  with 14 acceptance criteria in the exact bullet order below.
- Process reference: TDD_instructions.jpg supplied by the user. Each slice repeats
  red -> green -> refactor per criterion. Merge only when both CI jobs are green.
- Numbering decision: use **AC-010.Y.Z**, because this attachment is US10. The
  prompt's US3 wording was treated as an example copied from the previous story.
- Base: `45dff322a47a79328184ac99a35b5b72d5f404ef`, main == origin/main after fetch.
- Branch: `us10/reject-venue-booking`, local only. Initial working tree was clean.
- No production implementation, schema changes, shared database writes, emails,
  merge, push, or deletion of existing branches in this first prompt.

For your submission, retain the original user prompt and attachments alongside
this record. This section is a scope summary, not a verbatim copy of the prompt.
Record later prompts separately so reviewers can see what was requested at each step.

## Existing implementation inspected

- `frontend/src/features/venues/venueBookingService.ts`: holdVenue and
  releaseVenueBooking already exist. Reject uses a claim DELETE followed by a
  booking UPDATE; there is no mandatory-reason check, atomic rejection, or
  affected-row verification. A failed second write can leave claims released.
- `backend/supabase/migrations/0018_venues_and_bookings.sql`: reuse venue_bookings,
  venue_slot_claims, venue_closures and time_slots. Booking statuses are held,
  pending_approval, confirmed, rejected, cancelled and expired. **confirmed is the
  existing booking equivalent of approved**, separate from the overall event status.
- The existing Venue Staff update policy requires pending_approval and the caller
  as reviewed_by. The current release helper does not populate this field, so its
  successful mock responses must not be taken as proof of a working live rejection.
- No venue review queue/detail/approval service or existing AC-010 tests were found.
- Keep half-open timing intervals and existing event/buffer/maintenance claims.
  Explicit setup versus turnaround semantics need alignment with the booking owner.
- `.github/workflows/ci.yml` already has `verify` and `database`. Database tests run
  against disposable PostgreSQL, not shared Supabase.

## First slice: rejection

Eight executable tests are in
`frontend/src/features/venues/__tests__/venueBookingReview.test.ts`.
They import the real existing releaseVenueBooking function and mock only Supabase.
No placeholder implementation, missing import, skipped test or expected-failure
marker is used to manufacture a green suite.

Proposed next-step persistence contract: rejection calls the single atomic RPC
`reject_venue_booking({ p_booking_id, p_reason })`, returning `rejected` on success.
This RPC does **not exist yet**. The test imports no nonexistent module and fails
because the current helper makes unsafe separate writes / ignores RPC outcomes.
The database implementation should authenticate Venue Staff, lock and recheck the
pending booking, validate its reason, release its claims, record actor/time and
queue notification atomically. Identity/time come from the server, never the client.
The RPC name is a proposed contract for the next green step, not an existing API.
The cancellation path must remain compatible and needs regression checks when edited.

| Executable ID | Scenario and expectation |
| --- | --- |
| AC-010.4.1 | Server permission refusal is returned as failure, not success. |
| AC-010.8.1 | Null rejection reason is refused before database operations. |
| AC-010.8.2 | Empty rejection reason is refused before database operations. |
| AC-010.8.3 | Whitespace-only rejection reason is refused before database operations. |
| AC-010.8.4 | A nonblank reason is trimmed and sent with the booking ID to the atomic operation. |
| AC-010.10.1 | A failed decision does not trigger a separate claim deletion. |
| AC-010.12.1 | Server refusal of a second decision on confirmed booking is surfaced. |
| AC-010.12.2 | Server refusal of a second decision on rejected booking is surfaced. |

These tests prove client contract behaviour only. They do not prove RLS, actual
slot availability, rollback, server finality or notification delivery. Those need
real PostgreSQL tests in subsequent green slices. In particular AC4/10/12 are not
fully covered merely by the mocked cases above.

## Full acceptance-criterion test plan

The following cases are planned/reserved, **not executable tests yet**. This keeps
one short-lived slice focused while capturing the full story's test cases first.
Do not count these as passing or implemented. Check allocations before adding cases.

| AC (document order) | Planned IDs | Given / when / then |
| --- | --- | --- |
| 1 Pending queue | AC-010.1.1, .1.2 | Venue Staff loads mixed booking states -> only pending_approval; no pending rows -> explicit empty queue. |
| 2 Timing and requirements | AC-010.2.1, .2.2 | Open a pending booking -> stored event timing/requirements shown; inaccessible/missing ID -> unavailable without leaking details. |
| 3 Conflict display | AC-010.3.1, .3.2, .3.3 | Approved booking overlaps event or buffer -> conflict; blocked period overlaps setup/turnaround -> conflict; touching half-open boundaries without overlapping claimed cells -> no false conflict. |
| 4 Venue Staff only | AC-010.4.2 through .4.7 | Direct database decisions refused for organiser, coordinator, operations_manager, tech_support, attendee and anonymous caller. One unique ID per role; existing .4.1 is the client refusal case. |
| 5 Approval | AC-010.5.1 | Venue Staff approves unchanged, pending, conflict-free request -> booking confirmed, event status unchanged. |
| 6 Approval-time conflict check | AC-010.6.1, .6.2, .6.3 | Approved booking or closure appears after viewing -> approval refused; two competing approvals -> at most one succeeds. |
| 7 Approved slots unavailable | AC-010.7.1, .7.2 | After approval, another event cannot claim event or buffer slots; calendar/search agrees with database. |
| 8 Rejection reason | AC-010.8.5, .8.6 | Bypass UI with blank reason -> database refuses; valid reason -> rejected and stored. Client .8.1-.8.4 are executable above. |
| 9 Suggested alternatives | AC-010.9.1, .9.2 | Reject with optional alternative venue/arrangement -> retained and visible to coordinator; omit alternative -> valid rejection. |
| 10 Release held slots | AC-010.10.2, .10.3 | Successful rejection releases only its own claims; forced decision/audit failure -> request and claims remain unchanged. Client .10.1 is executable above. |
| 11 No amended approval | AC-010.11.1, .11.2 | Venue Staff cannot change timing/venue/requirements while approving; stale request changed by coordinator -> refuse and require reload. |
| 12 Final decisions | AC-010.12.3, .12.4, .12.5 | Database refuses repeat decision on confirmed and rejected rows; competing decisions record only one outcome. Client .12.1-.12.2 are executable above. |
| 13 Decision identity/time | AC-010.13.1, .13.2 | Approval and rejection retain server actor/time; spoofed client identity/time cannot override them. |
| 14 Coordinator notification | AC-010.14.1, .14.2, .14.3 | Approval notifies correct coordinator; rejection includes reason/alternative; retry does not duplicate notification. Verify delivery separately from queuing. |

## Dependencies / questions for the next slice

- US9 booking submission must supply pending_approval requests and requested cells.
- Reuse confirmed for approved bookings; do not add venue states to event.status.
- Agree whether the notification recipient is events.coordinator_id or the original
  booking requester if reassigned. Do not silently choose or send real messages.
- Optional alternatives have no dedicated existing storage/API. Choose the smallest
  compatible contract before implementing AC9; do not overwrite the requested venue.
- Atomic SQL approval must recheck actual closures/claims, excluding its own held
  claims. UI conflict display is advisory and cannot replace this database check.

## How to run and collect evidence

From PowerShell at the repository root:

```powershell
cd frontend
$env:VITE_SUPABASE_URL = 'https://example.supabase.co'
$env:VITE_SUPABASE_ANON_KEY = 'ci-placeholder-anon-key'
npm.cmd test -- src/features/venues/__tests__/venueBookingReview.test.ts --reporter=verbose
npm.cmd run typecheck
npm.cmd run lint
```

The red-phase test command is expected to exit 1. A missing package, syntax error,
missing fixture or blocked child process is NOT acceptable red evidence. Inspect
actual assertion failures before writing production code.

For the next green/refactor step, start with AC-010.8 blank-reason tests, write only
the needed validation, rerun those cases, then continue with the atomic rejection
slice. Add SQL tests before implementing its database behaviour. Run the complete
frontend suite after green and both CI jobs before merging.

## Documentation checklist for each prompt / TDD iteration

1. Record prompt number/date, story/subtask, AC IDs, branch and starting commit.
2. Keep requirement source and assumptions separate from implementation decisions.
3. Describe each test's Given/When/Then and expected outcome; distinguish planned
   cases, executable cases, mocks, database checks and manual checks.
4. RED: capture command, actual assertion text, test counts and why the failure
   demonstrates the missing behaviour. Save terminal output or a screenshot.
5. GREEN: record the smallest production change and the same test passing.
6. REFACTOR: record any cleanup plus unchanged passing tests (or explicitly none).
7. Link commits, PR, both CI job results, reviewer and Jira subtask update. Only
   mark complete after those exist; never substitute local results for CI evidence.
8. After successful merge delete that merged branch, then create the next small
   slice from updated main. Do not delete red, unmerged or teammates' branches.

Trunk-based development is about frequent integration, not branch churn alone.
Short-lived branches should normally merge within a day or two, then be deleted.
Reference: https://trunkbaseddevelopment.com/short-lived-feature-branches/

## Evidence from prompt 1

| Check | Observed result |
| --- | --- |
| New US10 file, verbose run | 8 failed / 8, exit 1: expected RED. |
| Existing suite, excluding only the new red file | 389 passed across 35 files, exit 0. |
| Typecheck | Passed, exit 0. |
| Lint | Passed, exit 0. |
| Database suite / live Supabase | Not run; no SQL changes in this slice. |
| CI jobs | Not run remotely; branch has not been pushed. |

Actual failure examples:
- AC-010.8.1-.8.3: `expected true to be false` because blank reasons currently succeed.
- AC-010.8.4: RPC spy expected once, received zero calls: atomic operation not used.
- AC-010.10.1: unexpected calls to venue_slot_claims then venue_bookings expose the
  separate-write boundary, rather than one transaction owning both changes.
- AC-010.4.1 and .12.1-.12.2: `expected true to be false`; current code never calls
  the proposed RPC and therefore does not consume its refusal. These are contract
  failures, not evidence that actual database permissions allow those decisions.

An initial sandbox `spawn EPERM` prevented Vite startup. That attempt was excluded
from RED evidence; the rerun outside the sandbox produced the assertion failures
above. No secret environment values were used: only dummy CI Supabase settings.

Baseline command (PowerShell from frontend):
```powershell
$env:TZ = 'Asia/Singapore'
npm.cmd test -- --exclude src/features/venues/__tests__/venueBookingReview.test.ts
```
The exclusion was only for comparison with existing tests, not added to config or
CI. A normal full test run includes the 8 red tests and must not pass yet.
GREEN, REFACTOR, PR, CI, merge and branch deletion are not yet performed.

## Current checkpoint: remaining Slice 1, AC10 RED (6 October 2026)

This checkpoint supersedes the obsolete eight-test baseline above. AC8 and
migration 0037 have already merged. The remaining Slice 1 work uses branch
`us10/rejection-completion`, based on main `60830eb`. Migration 0040 is reserved;
no new migration or implementation exists at this RED checkpoint.

Added `AC-010.10.2` to `backend/supabase/tests/venue_booking_review.sql`:
reject a pending booking through the existing authenticated Venue Staff UPDATE
path, then verify its event and both buffer cells are released while another
booking's cell remains. Fixtures insert all four cells before the action.
The rejection succeeds, but its claims remain: this is the missing behaviour,
not a missing export, SQL function, fixture or permission error.

Full runs (no test exclusions):

- Frontend: `npm.cmd test` from `frontend`, exit 0; 74 files passed,
  762 tests passed and 1 TODO (763 total).
- Database: `bash backend/supabase/tests/run_change_request_review.sh` from the
  repository root, disposable PostgreSQL 17 in Docker, exit 3. All preceding
  regression suites ran before the US10 checkpoint. US10: 5 checks, 4 passed,
  1 failed. AC-010.8.9 through AC-010.8.12 passed; AC-010.10.2 failed.
- The runner now places US10 after coordinator assignment so this expected
  failure does not prevent that regression suite from running.

Screenshot the US10 result table with its AC IDs and `5 | 4 | 1` summary, plus
the frontend `74 passed` / `762 passed | 1 todo` summary. Raw local logs are
`$env:TEMP/us10-ac10-red-database.log` and
`$env:TEMP/us10-ac10-red-frontend.log`; these logs are not committed artifacts.
This document records the observed results for Git review. No GREEN result,
RED commit, push or PR is claimed for this new branch yet.

### AC10 GREEN checkpoint (6 October 2026)

The RED checkpoint above is committed as `4b982cd`
(`test(us10): record RED slot-release check AC-010.10.2`).
Migration `0040_venue_booking_rejection.sql` adds an AFTER UPDATE trigger for
pending-to-rejected bookings. It deletes only that booking's claims within the
decision transaction and lets the existing claim-delete trigger retain covering
maintenance blocks. No existing policies or reason constraints are replaced.

The same test ran unchanged after implementation:

- Full database runner: exit 0; US10 summary **5 passed, 0 failed**.
  AC-010.10.2 changed from FAIL to PASS; all four AC8 checks still pass.
- Full frontend suite: exit 0; **74 files passed, 762 tests passed, 1 TODO**.
- Local raw logs: `$env:TEMP/us10-ac10-green-database.log` and
  `$env:TEMP/us10-ac10-green-frontend.log`. Screenshot the final case table and
  both totals alongside the RED screenshots.

This is the minimum implementation for AC-010.10.2, not completion of Slice 1.
Dedicated rollback/block interaction coverage, optional alternatives, finality,
server-recorded decision identity/time and the review UI remain subsequent work.
No migration was applied to shared Supabase. GREEN commit and push await approval.

### Next checkpoint: AC13 RED (6 October 2026)

AC10 GREEN was committed with approval as `b8b4399`
(`fix(us10): release rejected booking slots atomically`). Nothing has been pushed.

Added AC-010.13.2 to the existing SQL test file. Authenticated Venue Staff reject
a fresh pending booking while supplying `reviewed_at = 2000-01-01T00:00:00Z`.
The test requires the saved reviewer to match the session and the saved time to
fall within the server-observed action window. The UPDATE affects exactly one
row, but retains the supplied old timestamp: a behavioural RED, not a fixture error.
This case covers rejection timestamp integrity; it does not prove spoofed actor
handling or approval audit behaviour.

- Full database runner: exit 3; US10 **6 checks, 5 passed, 1 failed**.
  Only AC-010.13.2 fails; AC8 and AC10 remain green. Earlier regression suites run.
- Full frontend suite: exit 0; **74 files passed, 762 tests passed, 1 TODO**.
- Screenshot the AC13 FAIL row and `6 | 5 | 1` summary, plus frontend totals.
  Raw local logs: `$env:TEMP/us10-ac13-red-database.log` and
  `$env:TEMP/us10-ac13-red-frontend.log`.

AC13 RED commit and implementation await approval. Migration 0040 is unchanged
since the AC10 GREEN commit; no additional migration number has been consumed.

### AC13 GREEN
RED commit: 31c226c. The unchanged AC-010.13.2 now passes with a server-stamped actor and clock_timestamp(). Full database exit 0: US10 6/6 pass. Full frontend exit 0: 74 files, 762 pass, 1 TODO. Logs: us10-ac13-green-{database,frontend}.log in the Windows temporary directory. No shared deployment.


### AC9 storage RED
AC-010.9.1 asserts that the booking row model retains a suggested alternative. It fails on the existing schema because that field is absent (JSON record conversion drops unknown fields); no SQL syntax/import failure. Full database: 10 pass, 1 fail, exit 3. Frontend: 762 pass, 1 TODO, exit 0. Logs: us10-ac9-red-{database,frontend}.log. Finality, spoofed reviewer and rollback cases passed on first execution and are regression coverage, not claimed RED cycles.


### AC9 storage GREEN
RED commit: 2647b6a. Added nullable review_alternative to the existing table in reserved migration 0040. Unchanged schema contract passes. Full database: 11/11 US10 pass, exit 0. Full frontend: 762 pass, 1 TODO, exit 0. Logs: us10-ac9-green-{database,frontend}.log. No second migration file or shared deployment.


### AC8 form/service RED
Added four executable assertions AC-010.8.13-16 with compilable no-op scaffolds (no missing imports). They fail because blank reasons have no validation, valid decisions are not saved, and the form has no controls yet. Full frontend: 4 failed, 762 passed, 1 TODO; 2 failed files/74 passed. Full database remains 11/11 US10 pass. Logs: us10-form-red-{frontend,database}.log.


### AC8 form/service GREEN
RED commit: 81c41b0. Same four tests pass after pure reason validation, a single guarded update, and the rejection form. Full frontend: 76 files, 766 passed, 1 TODO. Full database: 11/11 US10 pass. Both exit 0. Logs: us10-form-green-{frontend,database}.log.


### AC9 form/readback RED
Five new alternative tests fail on absent form controls, omitted update payload, missing query mapping and missing coordinator display (AC-010.9.3-7). Full frontend: 5 failed, 766 pass, 1 TODO. Database persistence/omission regression .9.2 passes: full US10 12/12, exit 0. Logs: us10-alternative-ui-red-{frontend,database}.log. Existing reason assertion now allows the added alternative field while preserving status/reason expectations.


### AC9 form/readback GREEN
RED commit: 865c11e. All five new assertions pass unchanged. Full frontend 76 files, 771 pass, 1 TODO; full database 12/12 US10 pass; both exit 0. Optional alternatives are saved with the reason and displayed on the coordinator booking page. Logs: us10-alternative-ui-green-{frontend,database}.log.


### AC4 access RED
Real database tests exposed permissive-policy composition: a coordinator passed their own-booking USING policy and the staff-review WITH CHECK, which lacked a role check. AC-010.4.4 failed. Database US10 18 pass/1 fail; frontend seven role-visibility cases failed, 771 passed/1 TODO. Logs: us10-access-red-{frontend,database}.log. This is an actual authorization regression, not a mock-only failure.


### AC4 access GREEN
RED commit: cb14144. Added role to the review policy WITH CHECK and gated the form with the current session role. Unchanged tests pass: database US10 19/19; frontend 76 files, 778 pass, 1 TODO; both exit 0. Logs: us10-access-green-{frontend,database}.log. No coordinator cancellation or unrelated venue/equipment permissions changed.


### AC12 form finality RED
Six UI assertions fail: five non-pending statuses still show rejection and a refused decision allows retry. Double-click and service stale/error/network cases already pass and are regression coverage. Full frontend 6 failed, 782 pass, 1 TODO; full database US10 19/19 pass. Logs: us10-finality-red-{frontend,database}.log.


### AC12 form finality GREEN
RED commit: 986e278. Only pending bookings show rejection. Failed decisions retain input and lock retries until a manual reload; double-submit is guarded. Full frontend: 76 files, 788 pass, 1 TODO. Full database: US10 19/19 pass. Both exit 0. Logs: us10-finality-green-{frontend,database}.log. Refreshed origin/main is still 60830eb with no upstream changes.


### Review-page integration RED
Four integration assertions fail on the readback/page scaffolds: saved decision mapping, routed rejection, read failure/reload, and saved decision display. Existing tested form behaviour is unchanged. Full frontend: 4 failed, 789 passed, 1 TODO (77 files). Full database US10 19/19 pass. Logs: us10-integration-red-{frontend,database}.log. This is an integration checkpoint for previously tested AC8/AC13 behaviour, not a new slice.


### Review-page integration GREEN
RED commit: 06a4866. Readback and routed-page assertions pass unchanged. Full frontend 77 files, 793 pass, 1 TODO; full database US10 19/19 pass. Both exit 0. Logs: us10-integration-green-{frontend,database}.log. Route: /venues/bookings/:bookingId/review behind the existing venueBooking flag. Pending-queue navigation and full request/conflict details remain Slice 2.


### Late-response RED and final regressions
AC-010.12.17 exposes a late successful response invoking a callback after the form is unmounted (for example after navigation). Full frontend: 1 failed, 794 passed, 1 TODO. Manual reload/final-status regression .12.16 passes. Full database US10 20/20 passes, including maintenance-block preservation .10.4. Logs: us10-reload-red-{frontend,database}.log.


### Final Slice 1 GREEN
RED commit: 3bf1756. The unchanged late-response test now passes after suppressing callbacks from an unmounted form. Full frontend: 77 files, 795 passed, 1 existing TODO. Full database: US10 20/20 passed, entire runner exit 0. Typecheck, lint and production build all exit 0 after the fix. Build retains a non-failing chunk-size warning. Logs: us10-reload-green-{frontend,database}.log and us10-final-{typecheck,lint,build}.log. Labelled evidence excerpts are retained under docs/us10-evidence. No push, PR, shared migration application or main merge has occurred for this branch.
