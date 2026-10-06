# US17 - Assign / Reassign an Event Coordinator

Owner: Jaydon. Jira: SCRUM-61. Slice 1 branch: `us17slice1`.

## Slice 1 scope

Backend support for AC1's Lead-only assignment and event reading, and AC2's valid
coordinator assignment rules. The application recognises a Coordinator Lead profile
and displays the role label. The assignment queue and picker UI are not implemented.

`0038_coordinator_lead_assignment.sql` extends the profile role constraint, adds a
non-draft event SELECT policy and replaces the existing assignment function and guard.
It preserves the existing role restrictions against self-service profile changes.
It does not alter existing users' roles or unrelated venue/equipment permissions.

## Tests and documentation

Frontend: `frontend/src/features/auth/__tests__/coordinatorLeadProfile.test.ts`.
Database: `backend/supabase/tests/coordinator_assignment.sql`, included in the existing
Docker runner. Fixtures run inside a transaction that is rolled back. Auth interfaces
are simulated, but PostgreSQL constraints, role checks and RLS are real.

- AC-017.1.1: application recognises a Lead profile (frontend).
- AC-017.1.2: administrator can provision a Lead profile (SQL).
- AC-017.1.3-4: organiser denied assignment through RPC and direct update.
- AC-017.1.5-6: coordinator denied self-assignment through RPC and direct update.
- AC-017.1.7-8: legacy Operations Manager denied assignment through both routes.
- AC-017.1.9: Lead reads an unassigned submitted event's details; another organiser's
  draft is not exposed by the new policy.
- AC-017.2.1: Lead assigns a submitted event; organiser and status remain unchanged.
- AC-017.2.2: draft assignment rejected.
- AC-017.2.3: missing coordinator selection rejected.
- AC-017.2.4: organiser cannot be selected as coordinator.
- AC-017.2.5: nonexistent coordinator rejected.
- AC-017.2.6: one coordinator can hold multiple submitted events.
- AC-017.2.7: nonexistent event rejected.

AC2 rejection checks also verify that the draft and existing assignment stay unchanged.
IDs are unique across SQL and frontend; next available IDs are AC-017.1.10 and AC-017.2.8.

Recorded red-green cycles: AC-017.1.1, .1.2, .1.9 and .2.1. The remaining twelve tests
passed when added and are additional regression coverage, not TDD cycles. The shared
Google Docs TDD tab and PR hold red/green CI evidence. The automated test-case tracker
holds additional coverage. This document is a code/test index, not a substitute for CI logs.

Local final checks: 762 frontend tests pass, one TODO; the full database runner passes,
including all 15 US17 SQL cases. Typecheck, lint and build pass. Existing React test
warnings and the build bundle-size warning remain. CI must pass on the final PR head.

## Existing tests affected

US7 assignment checks now use a separate Lead fixture. The Manager fixture stays for
unrelated revalidation/history checks. US13 reassignment setup similarly uses a new
Lead fixture, retaining its Manager checks. The database runner reapplies 0038 after
the historical 0008 replay so subsequent tests exercise current assignment rules.

## Deployment and remaining slices

After review/merge, apply 0038 after 0037 using the team's deployment process. No shared
Supabase migration was performed by these tests. Administrators must provision the
appropriate Lead account explicitly; old Manager accounts lose assignment authority.
Do not rerun older migrations to change a user's role.

Once deployed, treat 0038 as immutable: future changes need a newly claimed migration.
Coordinate retirement or conversion of legacy Manager accounts with owners of other
features; no bulk conversion is included here.

## Slice 2 — reassignment rules, event access and history

Branch: `us17slice2`. Claimed migration: `0039_coordinator_reassignment.sql`.
Three grouped SQL tests were added through separate red/green cycles:

- AC-017.3.1: immediate active-event reassignment; completed/cancelled events refuse
  reassignment without changing their existing coordinator. Red: completed event allowed it.
- AC-017.4.1: old coordinator cannot approve after reassignment, denied approval leaves
  the event unchanged, and new coordinator can approve. Red: old coordinator could approve.
- AC-017.6.1: Lead reads actor, previous/new coordinator and time for assignment and
  reassignment, with no extra entries for failed attempts or unchanged selections.
  Red: history was not stored.

All three unchanged tests pass locally. Full database runner passes; frontend has 762
passed and one TODO. No additional non-TDD tests were added in this slice.
CI links belong in the shared TDD record and PR. Total US17: one frontend and 18 SQL cases.

0039 guards coordinator updates on the events table, covering original-request review
through the RPC and direct updates. Existing US4/US7 review fixtures now assign their
reviewer; their assertions are unchanged. This does not claim a full audit of all venue
and equipment actions in other stories. Existing US7 assigned-review checks remain.

History is trigger-written in the assignment transaction. Only Leads can read it through
authenticated access; browser writes are revoked. No backfill or invented administrator
identity is recorded. Referenced events/profiles cannot be deleted while history references
them. History UI is not included. The runner reapplies 0039 after historical 0008/0038 replay.

0039 has not been applied to shared Supabase by this work. Apply after 0038 once reviewed;
do not edit it after deployment. The AC's withdrawn-event wording needs confirming against
the team's withdrawal workflow: there is no separate withdrawn event status in the schema.
Remaining: queue/picker UI, notification triggers, cross-feature integration and live
acceptance checks. Do not mark the whole story complete.
