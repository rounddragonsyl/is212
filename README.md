# ConnectSphere — Event Planning and Venue Booking

SMU IS212 team project. React + TypeScript front end on Supabase (PostgreSQL, Auth, Row
Level Security).

Implemented so far: **US-005 — submit an event request**.

In progress: **Save Draft Event Request**. Draft validation and the save/update
service are connected to Save Draft on the event form. Repeated saves reuse the draft ID,
and explicit submission updates that same request. My Drafts lists saved drafts and
opens them in the existing form for editing. Automated tests use mocks; browser/live
database verification and draft access-policy work remain pending.

## Prerequisites

- Node.js 22+
- A Supabase project (free tier is enough)
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/cli) for applying
  migrations from the command line

## Setup

```bash
npm install
cp .env.example .env    # Windows: copy .env.example .env
```

Fill in `.env` from **Supabase dashboard → Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

`.env` is gitignored. Never put the `service_role` key in it — anything prefixed `VITE_`
is compiled into the browser bundle.

## Applying the migration

**Option A — dashboard (no CLI).** Open SQL Editor in your Supabase project, paste the
contents of [`supabase/migrations/0001_events.sql`](supabase/migrations/0001_events.sql)
and run it. The script is idempotent, so re-running it is safe.

**Option B — Supabase CLI.**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Apply migrations **in order**, `0001` through `0008`, including both `0005` files
before `0006`. The two files currently share a version prefix, so the CLI path above
needs that version collision resolved before it can be relied on; use the SQL Editor
for the existing sequence in the meantime.

### Change-request database baseline

[`0007_event_change_requests.sql`](supabase/migrations/0007_event_change_requests.sql)
records the existing US6 change-request table, four access policies and automatic
`updated_at` trigger from the shared Supabase exports. It stores proposed changes
separately from `events`; applying it does not approve requests or update event details.
It contains no exported test records. On an existing installation, it preserves rows
and recreates the named policies/trigger; `CREATE TABLE IF NOT EXISTS` does not repair
differences in an existing table's columns or constraints. Check the existing schema
before applying it. Authenticated SELECT/INSERT/UPDATE privileges are explicit, and
the coordinator policy uses the project's `current_user_role()` helper.

This is a baseline, not completed US7 security or review functionality. Coordinator
assignment, individual decisions/partial approval, clarification, notifications and
arrangement revalidation remain to be implemented. The baseline policies also do not
prevent forged review fields on insert, edits to other columns during withdrawal,
ineligible event statuses, or duplicate pending requests. Those protections need a
follow-up migration and authenticated database tests. An index enforcing uniqueness
is not included because the supplied exports did not include index definitions.

The supplied live event-read policies also differ from `0005_request_status.sql`:
coordinators currently see drafts in that export. This migration does not replace
event policies or reconcile that separate discrepancy. Do not rerun all earlier
migrations on the shared database merely to install this baseline.

Verification on 21 September 2026: applied all repository migrations in order to a
disposable PostgreSQL 17 container, then passed 19 SQL assertions covering RLS setup,
owner/coordinator/anonymous access, invalid inputs, withdrawal, unchanged event records,
and preservation of request values when rerunning `0007`. Supabase's `auth.users`,
`auth.uid()` and database roles/default grants were represented by a local test setup;
this exercised real PostgreSQL policies and constraints, not the live Supabase Auth/API.
These were one-off local checks, not new Vitest cases or checks added to CI. The existing
211 application tests also passed. Live Supabase verification and the security gaps
listed above remain separate follow-up work.

## US7 review rules (not yet connected)

`src/features/events/changeRequestReviewValidation.ts` prepares a review without
reading or writing Supabase. It reuses US6's `ProposedEventChanges` field names.
For a decision, every proposed field must appear exactly once as approved or rejected;
each rejected field needs a reason/follow-up. The result contains individual decisions
and only the accepted values, with an overall approved/partially approved/rejected
outcome. Requesting clarification instead requires a message and prepares no changes.
This is the proposed interaction for US7; clarification leaves the whole request
unresolved, rather than mixing approval and clarification in the same action.

Nothing calls this helper from the app yet. Migration `0008` adds the corresponding
database outcomes and review operation described below. Frontend service/UI integration,
notifications and arrangement revalidation remain. Checking the proposal's shape here
does not establish that a proposed date or attendance is valid; the database operation
validates the event produced by the accepted subset before saving it.

The 19 automated tests in
`src/features/events/__tests__/changeRequestReviewValidation.test.ts` use the agreed
`AC-007.Y.Z` format and the AC order in the supplied Jira export:

| Criterion | Case IDs | Coverage in this step |
| --- | --- | --- |
| 5 — approve/reject, including agreed clarification #104 | AC-007.5.1–AC-007.5.12 | Full/partial decisions, missing/duplicate decisions and malformed proposals |
| 6 — rejection reason | AC-007.6.1–AC-007.6.2 | Explanation required and retained per rejected field |
| 7 — request clarification | AC-007.7.1–AC-007.7.3 | Follow-up message, no approved values, incompatible actions rejected |
| 9 — apply only approved values | AC-007.9.1–AC-007.9.2 | Prepared values preserve explicit false/empty values and do not mutate input |

These tests cover pure logic, not completed ACs or communication to the organiser.
If Jira criteria are reordered, update the mapping with the team before adding cases.

### US7 database review operation

[`0008_change_request_review.sql`](supabase/migrations/0008_change_request_review.sql)
adds `events.coordinator_id` and `event_change_requests.field_decisions`, plus
`partially_approved` and `clarification_requested` request statuses. Existing events
start unassigned; there is no automatic assignment or assignment screen in this change.
An authenticated Operations Manager can call
`assign_event_coordinator(p_event_id, p_coordinator_id)` to assign/reassign an event.
Direct attempts by other signed-in roles to change that field are blocked.

`review_event_change_request(p_request_id, p_event_updated_at, p_review)` accepts the
same `action: decide` / `action: clarify` structure as the TypeScript validator. Pass
the event's `updated_at` from the comparison screen as the expected version. The
function locks the event and request, checks the current assigned coordinator and
pending status, and rejects stale event details. It loads proposed values from the
stored request (never from the reviewer), applies only approved fields, and stamps
the decisions, actor and time in the same transaction. An error rolls back both writes.
Rejected fields require explanations; clarification stores its message and changes no
event details. Timestamps without offsets are interpreted in Singapore time.

This is **change-request** review, separate from US4's original event approval.
US4's event-status actions are preserved. Direct browser edits of submitted event
details are now blocked, so updates to those details must use the review operation.
Draft editing/submission remains allowed. Change-request access is restricted to its
organiser and the assigned coordinator; insert/update column permissions prevent
spoofed reviewer metadata and proposal edits during withdrawal.

The function validates the resulting required fields, date interval and attendance,
but does not yet classify significant changes, flag arrangements for revalidation,
send notifications, or provide clarification-response/resubmission UI. It does not
change event lifecycle status or implement a full audit-history screen. The existing
US6 UI still blocks confirmed events and needs its eligibility rule corrected during
integration. Duplicate pending-request prevention remains a client precheck, not a
database uniqueness guarantee. Reconcile these dependencies before exposing review
actions to users; this migration has only been applied to disposable local databases.

Run the database checks with Docker Desktop running:

```bash
bash supabase/tests/run_change_request_review.sh
```

The script creates a disposable PostgreSQL 17 container, applies the migrations,
runs `supabase/tests/change_request_review.sql`, and reruns `0008` to verify record
preservation. It removes its container on exit, opens no host ports and never reads
`.env`. `supabase/tests/bootstrap.sql` simulates Supabase Auth identities and grants;
RLS/constraints/functions run in PostgreSQL, but live Supabase Auth/API is not tested.
Do not run these fixture files in shared Supabase. They are not part of `npm test` or CI.

Verified locally: **47 SQL checks** (43 US7 checks and 4 shared-workflow regressions),
plus **230 application tests**, lint and production build. SQL case IDs continue the
unit-test allocations: AC-007.2.1–18, .5.13–19, .6.3–4, .7.4–6, .9.3–11, .10.1,
and .13.1–3. Four `REGRESSION-US1/US4/US6` checks protect other stories rather than
claiming additional US7 ACs. Coverage includes access, reassignment, partial decisions,
invalid/stale reviews, a forced final-save failure with rollback, and rerun preservation.
Concurrent sessions have not yet been exercised by this suite.

## Roles

Roles live in `public.profiles.role`, never in `auth.users` — Supabase owns that table and
it cannot take extra columns. Valid values are constrained by `profiles_role_valid`:
`organiser`, `coordinator`, `venue_staff`, `tech_support`, `attendee`.

**Roles are assigned, not chosen.** `prevent_role_self_assignment` blocks a signed-in user
from updating their own role, and no client may insert a profile at all: the
`handle_new_user` trigger (`0005`) creates it in the same transaction as the account, with
the role decided server-side. An administrator assigns roles from the SQL editor, where
statements run without a JWT:

```sql
update public.profiles set role = 'coordinator'
where id = (select id from auth.users where email = 'someone@example.com');
```

Policies read the caller's role through `public.current_user_role()`. That function is
`SECURITY DEFINER` for a reason worth knowing: a policy on `profiles` that queries
`profiles` re-enters itself and Postgres fails with *infinite recursion detected in policy*.
Running as the owner with RLS bypassed breaks the cycle.

During development, the **Dev · act as** switcher changes your own role so one test account
can exercise stories written for all five. It calls `dev_set_my_role()`, which deliberately
reopens the escalation the trigger prevents. Before release:

```sql
drop function if exists public.dev_set_my_role(text);
```

and delete `DevAuthPanel` and `DevRoleSwitcher`.

### Seed a test organiser

US-005 needs a signed-in organiser; the real login screen is US-002. Until then the app
shows a **development sign-in panel**, visible only under `npm run dev` and never in a
production build.

1. Supabase dashboard → **Authentication → Users → Add user**.
2. Enter an email and password, and tick **Auto Confirm User** — without it Supabase
   waits for an email confirmation that never arrives on a local project.
3. Run `npm run dev`, enter those credentials in the development sign-in panel.

Adding the user creates their `organiser` profile automatically, through the
`on_auth_user_created` trigger in `0005`.

> **Note for the oral exam:** the profile used to be created by the browser after first
> sign-in. That raced the session lookup — a new user saw *No organiser profile* until they
> reloaded — and let the client take part in choosing its own role. Creating it in a trigger
> on `auth.users` fixes both: the row exists before any session can, and the client never
> inserts into `profiles`. See [`0005_profile_on_signup.sql`](supabase/migrations/0005_profile_on_signup.sql).

## Running

```bash
npm run dev        # Vite dev server
npm run test       # Vitest, once
npm run test:watch # Vitest, watch mode
npm run coverage   # coverage report for src/features
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # typecheck + production build
```

## Project structure

```
src/
├── lib/supabase.ts              single Supabase client
├── components/ui/               shared presentational components
├── components/layout/           app shell, navigation, footer
└── features/
    ├── auth/                    session plumbing (US-002 owns the real story)
    └── events/                  one folder per backlog component
        ├── types.ts
        ├── validation.ts        PURE functions — no React, no Supabase, no I/O
        ├── useEventRequestForm.ts form state and separate save/submit actions
        ├── draftValidation.ts   incomplete draft validation, separate from submission
        ├── eventService.ts      submits new event requests to Supabase
        ├── eventDraftQueryService.ts lists and loads a signed-in organiser’s drafts
        ├── eventDraftService.ts saves new drafts and updates existing owned drafts
        ├── components/
        └── __tests__/
supabase/migrations/             database schema, RLS, triggers
```

Future features (`venues`, `bookings`, `equipment`, `registration`, `notifications`)
become sibling folders under `src/features/`. The folder name is simultaneously a backlog
component, a C4 component and a directory, so tracing a requirement to its implementation
is one step.

See [CLAUDE.md](CLAUDE.md) for the architecture rules the whole team follows.

## Acceptance criteria → tests (US-005)

| AC | Covered by |
| --- | --- |
| AC-005.1 — capture preliminary information | `validation.test.ts` (`AC-005.1: …`), `EventRequestForm.test.tsx` |
| AC-005.2 — cannot submit with missing/invalid required fields | `validation.test.ts` (`AC-005.2: …`), `EventRequestForm.test.tsx` |
| AC-005.3 — informed on success | `EventRequestForm.test.tsx`, `eventService.test.ts` |
| AC-005.4 — informed on failure, with a reason | `eventService.test.ts` (`AC-005.4: …`), `EventRequestForm.test.tsx` |
| AC-005.5 — unique reference, status Submitted | `eventService.test.ts` (`AC-005.5: …`), `0001_events.sql` trigger |

Every test name begins with the acceptance criterion it covers, so
`npm run test -- --reporter=verbose` prints the traceability matrix.

## Acceptance criteria → tests (Save Draft Event Request, in progress)

Save Draft Event Request is **US-001**. Its criteria follow the Jira order:

| Requirement ID | Acceptance criterion |
| --- | --- |
| AC-001.1 | Save an event request as a draft before submitting it |
| AC-001.2 | Save a draft with incomplete information required for final submission |
| AC-001.3 | Identify a saved draft as Draft status |
| AC-001.4 | Reopen a saved draft and continue editing its information |
| AC-001.5 | Saving or editing a draft does not submit it for review |
| AC-001.6 | Treat the request as submitted only after an explicit submission action |

Each automated case has a unique ID, for example `AC-001.2-01`. The final number
identifies a test case, not another acceptance criterion. IDs are unique across the
story's test files, including each parameterised input row. Within each file, group
tests by criterion and sort numerically by story, criterion, then case number. Keep existing IDs stable
and allocate the next unused number for new cases. Tests spanning several criteria use
one primary ID and name additional criteria in parentheses. Invalid-value and failure
checks support the associated criterion; they are not new customer requirements.

Current automated case ranges:

| Criterion | Case IDs | Count |
| --- | --- | ---: |
| AC-001.1 | AC-001.1-01 through AC-001.1-12 | 12 |
| AC-001.2 | AC-001.2-01 through AC-001.2-22 | 22 |
| AC-001.3 | AC-001.3-01 through AC-001.3-02 | 2 |
| AC-001.4 | AC-001.4-01 through AC-001.4-34 | 34 |
| AC-001.5 | AC-001.5-01 through AC-001.5-04 | 4 |
| AC-001.6 | AC-001.6-01 through AC-001.6-09 | 9 |

Run `npm run test -- --reporter=verbose` to see individual case IDs and results.
Automated tests live in
[`draftValidation.test.ts`](src/features/events/__tests__/draftValidation.test.ts) and
[`eventDraftService.test.ts`](src/features/events/__tests__/eventDraftService.test.ts),
with form tests in `EventRequestForm.test.tsx` and draft-submission tests in `eventService.test.ts`.
`eventDraftQueryService.test.ts`, `draftFormValues.test.ts` and `DraftPages.test.tsx`
cover listing, restored values and the list-to-editor workflow.
Tests check validation, services with mocked Supabase responses, and the form with mocked services.
They do not connect to Supabase or prove the complete user flow or RLS enforcement works.

| AC / supporting rule | Current evidence | Remaining checks |
| --- | --- | --- |
| AC-001.2 — allow incomplete required fields | Unit tests accept empty drafts, blank fields and a single supplied date | Save incomplete data to Supabase and reopen it |
| Supplied values respect database constraints | Unit tests reject invalid dates, unordered date ranges, and invalid attendance; include boundary values | Verify constraints against live Supabase |
| AC-001.6 — explicit submission | Form and service tests verify submission uses the saved draft ID and full validation | Verify transition and reference trigger against live Supabase |
| AC-001.1, AC-001.4, AC-001.5 — save/edit without submission | Service and form tests check draft saves, repeated edits, guarded updates and failures | Live database tests |
| AC-001.3 — identifiable Draft | Form and page tests verify Draft indicators after saving and in the list | Browser and live database verification |

Run the draft checks with:

```bash
npm run test -- src/features/events/__tests__
```

Drafts use the existing `events` table. Empty text, dates and attendance become `null`.
Supplied attendance must be a positive PostgreSQL integer, and an end date must follow
the start when both are supplied. Past dates may remain in drafts; submission still
requires a future start. These validation rules do not save data or change status.

`saveEventDraft(input, draftId?)` accepts the complete form snapshot. Omit the ID for
a new draft; reuse the returned `draft.id` for later saves. Updates filter by ID,
signed-in owner and current Draft status, and never set workflow fields such as status
or reference. Missing input fields clear their stored values, so this is not a partial
patch API. A missing/stale draft returns a failure rather than inserting a replacement.
Network failures are reported without automatically retrying a potentially successful save.

The form keeps its draft ID during the current visit, preserves fields after saves/errors,
and disables editing and both actions while saving/submitting. It uses the shared Draft
badge and clears outdated success messages when values change. `useEventRequestForm`
keeps this state separate from the form markup. Switching accounts remounts the form.
`submitEventRequest(input, draftId?)` validates all submission fields, then updates the
owned draft's latest details and status together; a stale ID never falls back to an insert.
Saved drafts can be reopened through `/drafts` or directly at `/drafts/:id`, including
after refreshing that editor URL. The new-request page does not restore unsaved changes;
use My Drafts to find a request saved before leaving that page.

Before completing the story, verify owner access and coordinator draft restrictions
with authenticated users. The inspected live coordinator policies currently do not
exclude drafts; coordinate the policy change with the request-status work. Record live
test results and review evidence in the team's Jira/test tracker, without treating unit
test success as completion of the story.

## Design decisions worth knowing

- **Validation lives in two places on purpose.** `validation.ts` exists for the error
  message; the database CHECK constraints exist for integrity when something bypasses the
  UI. Defence in depth, not accidental duplication.
- **Business rules run in the client and in Postgres, with no middle tier.** That is the
  Supabase model. The trade-off — no server-side application layer to hold logic that
  cannot be expressed in SQL — is recorded in the C4 documentation rather than left to
  look accidental. If a rule ever needs a server, it becomes one Edge Function.
- **Required fields are not `NOT NULL` columns.** US-001 lets organisers save incomplete
  drafts, so the requirement is enforced by a CHECK keyed on `status` instead.
- **References come from a database trigger**, not the client, so two simultaneous
  submissions cannot mint the same number. The sequence is global, so reference numbers do
  not restart each January.
- **Statuses are stored lowercase** (`submitted`) and rendered from `EVENT_STATUS_LABELS`
  (`Submitted`).

### Loading a saved draft

`getEventDraft(id)` in `eventDraftQueryService.ts` reads one draft using ID, signed-in
owner and Draft status filters. It restores existing field names, converts missing
values to empty inputs, and keeps stored date timestamps unchanged for the editor to
format. Opening a draft performs no write. Missing, inaccessible and submitted requests
share one unavailable message.

`eventDraftQueryService.test.ts` covers loading, incomplete data, filters and failures
using mocked Supabase responses. These checks do not prove live RLS enforcement.
`listEventDrafts()` retrieves owned drafts ordered by most recently saved. My Drafts
(`/drafts`) is linked from organiser navigation, home and the new-request page. It shows
Draft badges, last-saved times and an Untitled draft fallback for unnamed requests.
The resume page (`/drafts/:id`) loads an existing draft into `EventRequestForm`; subsequent
saves and explicit submission retain its ID. Loading never writes or submits anything.
After successful submission, the resume page shows confirmation rather than offering
another save of the same draft. Returning to My Drafts reloads the list.

Both pages provide loading, empty/error and retry states as appropriate. Their access
guard waits for a signed-in organiser and resets loaded state on account changes. Stale
responses from a previous account or draft cannot replace the current editor.
`draftFormValues.ts` restores attendance as text and converts stored date timestamps
for datetime-local inputs, matching the existing submission parser's browser timezone.
This does not enforce Singapore time for users outside Singapore; a consistent
application-wide timezone policy still needs coordination with the submission feature.

The page tests use mocked services and the query tests use mocked Supabase. They do not
prove live persistence, RLS, or trigger behaviour. No fake database is shipped in the app.
There is no autosave: users must save changes before navigating away.
