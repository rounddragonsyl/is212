# US7 significant-change display — 27 September

This is the AC11 display step, not the AC12 arrangement revalidation hook.

## Changes

- src/features/events/changeRequestSignificance.ts: pure classifier of stored proposal
  fields. Date/time (proposedStart/proposedEnd), expectedAttendance, layoutPreference,
  accessibilityRequirements and equipmentRequirements are significant. Layout/accessibility
  are the current mapping for venue requirements. Other supported fields are ordinary.
- src/features/events/components/ChangeRequestSignificance.tsx: badge and affected-field
  explanation, using the same field labels as the existing request screens.
- src/features/events/components/ChangeRequestSummary.tsx: displays it for both roles,
  beside the existing request information. It does not replace the status badge.
- Two new test files below; README/CLAUDE and prior review UI notes updated for current scope.

## Meaning and limits

The stored proposed_changes object represents a diff. Classification uses which fields it
contains, including clearing optional requirements. It does not infer venue/equipment needs
from specialArrangements or other free text. There is no numeric attendance threshold.

An ordinary-only or empty object classifies ordinary; empty proposals are still rejected
by the separate submission/review validation. Undefined values are not proposed changes.
The classifier itself is not an input validator or permission check.

Labels remain stable after approval/rejection because they describe the request. A request
with a rejected equipment change and an approved description change is still significant;
that alone must NOT trigger equipment revalidation. AC12 will evaluate accepted fields
at final approval. No event status, bookings, equipment or database data changes here.
No new migration or shared Supabase action is required.

## New tests (13)

src/features/events/__tests__/changeRequestSignificance.test.ts:

| ID | Check |
| --- | --- |
| AC-007.11.1 | A proposed start date/time change is significant. |
| AC-007.11.2 | A proposed end date/time change is significant. |
| AC-007.11.3 | Attendance is significant. |
| AC-007.11.4 | Room layout is significant. |
| AC-007.11.5 | Accessibility requirements are significant. |
| AC-007.11.6 | Equipment requirements are significant. |
| AC-007.11.7 | Other supported fields alone are ordinary edits. |
| AC-007.11.8 | Empty proposals/undefined significant fields do not falsely flag significance. |
| AC-007.11.9 | Clearing an equipment requirement remains significant. |
| AC-007.11.10 | Mixed proposals produce a stable significant-field order without mutation. |

src/features/events/__tests__/ChangeRequestSignificance.test.tsx:

| ID | Check |
| --- | --- |
| AC-007.11.11 | Shared summary displays significance, reason and existing review status together. |
| AC-007.11.12 | Description-only request shows Ordinary edit without significant-field explanation. |
| AC-007.11.13 | A rejected request keeps its original classification and outcome badge. |

Verification: 368 app tests passed; lint and production build passed (including TypeScript).
Existing build bundle-size warning remains. SQL was not changed or rerun this step.

## Manual check

Run npm run dev. In Requested changes, view an existing request containing attendance,
start/end, room layout, accessibility or equipment changes: it should say Significant change
and list those fields. View a description/name-only request: it should say Ordinary edit.
Both organiser and assigned coordinator use this same summary. Request outcome/status and
reply/review controls should remain unchanged. A rejected significant request keeps its label.

Jaydon reported the earlier organiser reply UI flow working against shared Supabase; this
new classification display has automated coverage and still needs a browser check.

## Jira/team update

SCRUM-58 (significant versus ordinary flag): implementation ready for review after browser
verification; do not mark Done before the team's review process. SCRUM-59 (revalidation hook)
remains separate pending work. No new database migration to apply.
