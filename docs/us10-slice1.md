# US10 Slice 1: venue booking rejection

Completed locally on `us10/rejection-completion`, based on `origin/main` at
`60830eb`. Main was fetched again during verification and had not advanced.
No merge conflict exists against that checked revision. Recheck before pushing
or merging if teammates update main. No push, PR, merge or shared Supabase
migration application was performed for this branch.

## Delivered

- Venue Staff can reject a pending booking with a required nonblank reason and
  an optional alternative venue/arrangement. The coordinator's existing booking
  view displays both the reason and alternative.
- Database rejection stamps the authenticated actor and server time, and releases
  only that booking's event/buffer claims in the same transaction. Cleanup failure
  rolls back the decision. Covering maintenance blocks remain in force.
- Final decisions cannot be changed by Venue Staff. The service checks that its
  guarded update affected a row. The form prevents duplicate submissions and
  locks retry after a failed/uncertain response until reload. Late responses from
  an unmounted form cannot update another page.
- A real-policy test found and fixed a coordinator rejection bypass caused by
  permissive UPDATE policies combining their USING and WITH CHECK expressions.
  The review policy now requires Venue Staff in both clauses.

Migration `0040_venue_booking_rejection.sql` is the single reserved migration for
this work. It extends the existing booking table and triggers without replacing
the catalogue or renumbering applied migrations. It reuses `0037` reason validation.
Apply 0040 before deploying these readers/writers to a shared environment; that
deployment remains a human-controlled step.

The decision page is `/venues/bookings/:bookingId/review`, gated by the existing
`VITE_FEATURE_VENUE_BOOKING=true` switch. This slice supplies the decision page,
not the navigation queue. Slice 2 adds pending-queue navigation, request details
and conflict display. Slice 3 implements approval; Slice 4 handles notifications
and final integration/documentation. The whole US10 is not complete yet.

## Observed verification

- Full frontend suite: **77 files passed; 795 tests passed, 1 existing TODO**.
- Full disposable PostgreSQL suite: **exit 0**, including **20 US10 checks**.
  The 20 are the US10 subset, not the total database suite count.
- Typecheck, lint and production build: **exit 0**. Build has a non-failing
  chunk-size warning. No browser session against shared Supabase was exercised.
- Test IDs retain the supplied US10 numbering. Existing tentative-hold tests
  also use AC-010; their IDs were preserved. New IDs avoid their allocations.
- Regression cases passing on their first run are labelled as such in the
  chronological record. No fabricated RED result is claimed for those cases.
  Finality checks cover sequential/stale decisions; there is no two-session race
  test in this single-session SQL suite.

## Local TDD commits and evidence

Each RED/GREEN checkpoint ran both full suites with no test exclusions. No
feature implementation was added until its RED failure was observed and checked for the intended cause.
The user's final slice-level approval authorized the remaining local cycles.
Compilable scaffolds allowed new frontend modules to fail assertions rather than
imports; they were replaced by implementation in the corresponding GREEN commits.

| Evidence prefix | Scope | RED commit | GREEN commit |
| --- | --- | --- | --- |
| 01-slot-release | AC10 slot release | `4b982cd` | `b8b4399` |
| 02-decision-record | AC13 server timestamp | `31c226c` | `a139d5d` |
| 03-alternative-storage | AC9 row model | `2647b6a` | `eaa9fb2` |
| 04-rejection-form | AC8 reason/service/form | `81c41b0` | `ebb57ec` |
| 05-alternative-display | AC9 input and coordinator view | `865c11e` | `8310824` |
| 06-role-access | AC4 UI and real database roles | `cb14144` | `6e93342` |
| 07-finality | AC12 final statuses/retries | `986e278` | `401b4e4` |
| 08-review-page | AC8/13 integration and readback | `06a4866` | `c57fa23` |
| 09-late-response | AC12 navigation while saving | `3bf1756` | `53cc749` |

The four mandatory-reason SQL tests in migration 0037 were completed and merged
previously. They stay green throughout these cycles. Their earlier evidence
is retained in `us10-test-first.md`.

## Screenshot commands (PowerShell, repository root)

Show all labelled failing checkpoints; capture each checkpoint's case IDs and
frontend/database summaries, rather than the entire long output at once:

```powershell
Get-Content -Encoding UTF8 .\docs\us10-evidence\*-RED.txt
```

Show the corresponding passing checkpoints:

```powershell
Get-Content -Encoding UTF8 .\docs\us10-evidence\*-GREEN.txt
```

Show only one RED/GREEN pair, for example the database authorization fix:

```powershell
Get-Content -Encoding UTF8 .\docs\us10-evidence\06-role-access-RED.txt
Get-Content -Encoding UTF8 .\docs\us10-evidence\06-role-access-GREEN.txt
```

Show final validation and local commit history:

```powershell
Get-Content -Encoding UTF8 .\docs\us10-evidence\final-checks.txt
git log --oneline origin/main..HEAD
```

These commands display recorded local runs, not fresh executions or GitHub CI.
The excerpts are committed so they remain accessible in Git. Raw logs remain in
the Windows temporary directory at the paths printed in each excerpt.
For Scrum, record the US/AC, branch, RED and GREEN commit IDs, screenshot pair,
failure cause and fix. Link the later PR and both successful CI jobs after push.

The user reviews the completed local slice before push/PR. Merge only after the
required review and both CI jobs are green, then delete the short-lived branch.
