# US10 Slice 2: pending booking review

## Current checkpoint: AC1 complete locally; AC2 and AC3 pending

Branch: `us10/pending-venue-review`, based on main `a28842c`, which includes
the merged Slice 1 implementation. No push or PR has been performed for this branch.
The unrelated untracked root `package-lock.json` has been left untouched.

The team explicitly switched the remaining US10 slices to code-first development.
For AC1, implementation came first, then its tests were added immediately before
moving to another AC. Code and tests are committed together with AC-tagged messages.
The forced-break record below demonstrates test effectiveness; it is **not TDD
RED evidence**. Slice 1's existing RED/GREEN evidence is unchanged.

## AC1 delivered

- Venue Staff get a Booking requests navigation link and `/venues/review` page,
  under the existing `VITE_FEATURE_VENUE_BOOKING` switch.
- The service requests only `pending_approval` rows, oldest first with an ID
  tie-breaker. Each queue item opens the existing Slice 1 decision page.
- Empty/loading states are explicit. Failed reads show an error with manual reload,
  not a misleading empty queue. Other roles do not load the page's queue.
- Stale responses from a previous staff session cannot overwrite the current queue.
  Existing booking RLS remains unchanged; the frontend gate is not a new database policy.

## Validation and coverage

- Full frontend run with coverage: **90 files passed; 876 tests passed, 1 existing TODO**.
- Full disposable database runner: **exit 0**, including the existing 20 US10
  rejection checks. No new Slice 2 database behaviour is claimed yet.
- Typecheck, lint and build passed. Build retains its non-failing chunk-size warning.
- The two new queue source files each have **100% lines, statements, branches and
  functions** covered. Across all configured feature files: **87.90% lines/statements,
  86.99% branches, 93.11% functions**. The repository-wide 100% target is not reached;
  remaining gaps are outside these new queue files. Coverage scope was not narrowed.
- SQL assertions are behavioural integration tests; Vitest cannot measure PL/pgSQL
  coverage. Do not combine SQL pass counts with frontend coverage percentages.
- CI now runs `npm run coverage` and uploads the complete `frontend-coverage`
  artifact, including HTML, LCOV and JSON summary. This workflow change has been
  checked locally but has not run on GitHub for this unpushed branch.

## Forced-break evidence

In `venueBookingQueueService.ts`, the status filter was temporarily changed from
`pending_approval` to `confirmed`. AC-010.1.1 failed on the wrong query value:
**1 failed, 3 passed**, exit 1. The original bytes were restored in a `finally`
block; the defect was never committed. The restored full coverage run above passed.
This proves that the query-contract assertion detects the wrong filter. It does
not by itself prove real Supabase API behaviour.

Saved artifacts under `docs/us10-slice2-evidence`:

- `AC-010.1.1-forced-break.log`: deliberate failure.
- `AC-010.1-restored-full-frontend.log`: restored full-suite run and coverage.
- `full-database.log`, `typecheck.log`, `lint.log`, `build.log`: validation outputs.
- `coverage-summary.json`: machine-readable measured coverage.
- `frontend-coverage.zip`: complete coverage report; extract and open `index.html`.

Logs are saved console output normalized to UTF-8 without terminal colour codes.
Copy the coverage archive/report and the evidence rows below into submission folder 3.
The owner and PR fields must be filled with the actual person and PR after creation;
no owner or PR URL has been invented.

## Evidence rows for Nicole's sheet

All rows: story **US10**, criterion **AC1**, owner **to fill**, PR **not opened**.
The UI tests use a mocked service, so they are component unit tests, not database
integration or end-to-end tests. Commit references can be found using each full AC ID.

| Test ID | Test name/scenario | Type | Scenario class | Test file | Forced-break log |
| --- | --- | --- | --- | --- | --- |
| AC-010.1.1 | Only pending rows, stable oldest-first order | Unit | Normal | venueBookingQueueService.test.ts | AC-010.1.1-forced-break.log |
| AC-010.1.2 | No matching requests gives an empty queue | Unit | Boundary | venueBookingQueueService.test.ts | — |
| AC-010.1.3 | Database refusal is not an empty queue | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.4 | Interrupted request returns an error | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.5 | Queue links to the correct booking review | Unit (component) | Normal | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.6 | Empty queue has an explicit message | Unit (component) | Boundary | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.7 | Failed load can be retried manually | Unit (component) | Failure | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.8 | Another role cannot load the staff queue | Unit (component) | Failure | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.9 | Unreadable venue retains its queue item | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.10 | Successful null rows map to an empty queue | Unit | Boundary | venueBookingQueueService.test.ts | — |
| AC-010.1.11 | Wait for session loading to finish | Unit (component) | Boundary | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.12 | Older response cannot overwrite a new session's queue | Unit (component) | Conflict | VenueBookingQueuePage.test.tsx | — |

## Capture commands (PowerShell, repository root)

```powershell
# Deliberate failure: capture the AC identifier, wrong filter and failing totals.
Get-Content -Encoding UTF8 .\docs\us10-slice2-evidence\AC-010.1.1-forced-break.log

# Restored full-suite totals and aggregate coverage.
Select-String -Path .\docs\us10-slice2-evidence\AC-010.1-restored-full-frontend.log -Pattern 'Test Files','Tests  ','All files'

# Database run's final US10 subset summary (the full log contains preceding suites).
Get-Content -Encoding UTF8 .\docs\us10-slice2-evidence\full-database.log -Tail 30

# Find the AC-tagged implementation/test commit; use --all until the branch is merged.
git log --all --oneline --grep='AC-010.1.1'
```

## Remaining Slice 2 work

AC2 adds event timing and stored venue requirements. AC3 adds conflict information
including setup/turnaround cells. This needs narrowly scoped Venue Staff access to
event details without opening general event reads.

Proposed migration claim: **0044 for US10 Slice 2: Venue Staff-only access to
pending booking details and conflict information, including setup/turnaround
slots, without granting general event access.** Reservation confirmation is
pending. No 0044 migration file has been created. Recheck main's migration numbers
before creating it once the reservation is confirmed.
