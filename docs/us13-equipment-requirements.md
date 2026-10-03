# US13 Record Equipment Requirements (SCRUM-19)

The assigned Event Coordinator turns the Organiser's free-text equipment request into
catalogue lines: an equipment type, a quantity and technical requirements. Technical
Support can see every line and is notified when lines are added, changed or removed.
Recording a line reserves nothing; reserving is US14 (SCRUM-20).

Test cases and results: [test-cases/US13_test_cases.md](test-cases/US13_test_cases.md).

## Deploying

1. Apply `backend/supabase/migrations/0020_event_equipment_requirements.sql` after 0019.
   It creates new tables and policies and replaces no existing ones. The only change to
   an existing table is a new `events` SELECT policy for Technical Support. It was applied
   to shared Supabase on 3 October.
   That project had **no policies at all on 0019's `equipment_types`**, so the catalogue
   was invisible in the app. `types_select_staff` was re-created exactly as written in
   0019. Other 0019 tables may also be missing policies; Nicole (0019/US14) is checking.
2. Deploy the frontend. Coordinators open an approved, planning or confirmed request
   and choose **Open equipment requirements** (`/requests/:id/equipment`). Technical
   Support users get an **Equipment** link in the top navigation (`/equipment`).
3. The catalogue (`equipment_types`) must contain at least one type. Only Technical
   Support can add types (0019 policy).

## Design decisions

| Decision | Why |
|---|---|
| A new `event_equipment_requirements` table instead of reusing 0019's booking lines | A booking line needs a delivery venue and dates, and creating one is a reservation request. Keeping the Coordinator's list separate makes AC-013.5 ("recording does not reserve") true by construction. 0019 is already in use, so it is not modified. |
| `booking_line_id` is the US14 hook | US14 reserves against a booking line and then links it here. Release (SCRUM-131) goes through 0019's existing `equipment_allocations`, so no new reservation model was added. |
| Authorisation lives in the database | The browser talks to Supabase directly. RLS allows writes only by the assigned Coordinator (`events.coordinator_id`). Column grants let the browser write only type, quantity, notes and essential, so status, the reservation link, the creator and the event cannot be forged. Hidden buttons are a courtesy only. |
| A trigger enforces "approved event" | The trigger raises a distinct error (22000) for the wrong event status, separate from RLS's "not your event" (42501), so the UI can explain which one applies. Approved, planning and confirmed are allowed because equipment is worked out during planning. |
| Changing a held line's type or quantity releases its units | The held units were chosen for the old type and quantity, so they no longer fit. The trigger cancels them and sets `pending_review` in the same transaction as the edit. Editing only notes or the essential flag keeps the reservation. |
| Release cancels allocations rather than deleting them | Cancelled rows keep the history. 0019's trigger then recounts `quantity_reserved`. Checked-out and returned units are physical facts and are left alone. |
| Notifications are trigger-written, one row per Technical Support user | Every write path is covered, including direct API calls. A failed notification rolls back the change. A removal notice copies the type name and quantity, so it outlives the deleted line. A status set by reservation work does not notify, because that is Technical Support's own action. |
| SECURITY DEFINER helper functions in the policies | The requirement policies read `events` and the `events` policy reads requirements. Plain policies would recurse, as with `current_user_role()`. |
| Non-essential is a flag, not a fifth stored status | It is the Coordinator's judgement, while the stored status is the reservation outcome. Held equipment takes precedence in the display (assumption A1). |

## Contract for US14

- Reserve against an `equipment_booking_lines` row, then, as the database owner or service
  role, set `event_equipment_requirements.booking_line_id` and `status`. The browser
  cannot write either column.
- Keep `status` in step with the line's allocations: `reserved`, `partially_reserved` or
  `unavailable`.
- When a Coordinator changes type or quantity, or removes the line, 0020 has already
  cancelled the line's reserved allocations and unlinked it. The booking line itself is
  left in place with `quantity_reserved = 0`, and US14 decides what to do with it.
- Status writes from reservation work never notify Technical Support.

## Files

| File | Change |
|---|---|
| `backend/supabase/migrations/0020_event_equipment_requirements.sql` | New tables, column grants, RLS, the event-status guard, reset and release triggers, notifications, and the Technical Support events policy |
| `backend/supabase/tests/equipment_requirements.sql` | 56 database checks |
| `backend/supabase/tests/run_change_request_review.sh` | Runs the new SQL file at the end |
| `frontend/src/features/equipment/types.ts` | Domain types |
| `frontend/src/features/equipment/validation.ts` | Pure rules: who may manage, input validation, display status, when a change returns a line to pending review |
| `frontend/src/features/equipment/equipmentRows.ts` | Pure mapping from database rows to app objects |
| `frontend/src/features/equipment/equipmentRequirementService.ts` | The only Supabase access for the feature, mapping database refusals to messages |
| `frontend/src/features/equipment/components/*` | Editor, form, list, status badge, Organiser request panel and Technical Support view |
| `frontend/src/features/equipment/pages/*` | Coordinator and Technical Support pages |
| `frontend/src/features/equipment/__tests__/*` | 57 app tests |
| `frontend/src/App.tsx`, `components/layout/TopNav.tsx`, `features/events/pages/ReviewRequestDetailPage.tsx` | Routes, the Technical Support nav link, and the Coordinator's link from an eligible request |

## Test allocation

| Criterion | App tests | Database checks | Manual |
|---|---|---|---|
| AC-013.1 | .1.1–.1.11 | .1.12–.1.24 | .1.25 |
| AC-013.2 | .2.1–.2.19 | .2.20–.2.26 | (in .1.25) |
| AC-013.3 | .3.1–.3.11 | .3.12–.3.17 | |
| AC-013.4 | .4.1–.4.5 | .4.6–.4.18 | .4.19 |
| AC-013.5 | .5.1–.5.2 | .5.3–.5.7 | |
| AC-013.6 | .6.1–.6.9 | .6.10–.6.21 | .6.22 |

The next unused IDs are AC-013.1.26, .2.27, .3.18, .4.20, .5.8 and .6.23.

Totals after this story: **446 app tests** (389 before) and **203 database checks**
(147 before).

## Known gaps

- **AC-013.6.22 is deferred until US14.** The app cannot create a reservation yet, and
  faking one needs admin SQL on the shared database. AC-013.6.1–.21 cover the behaviour.
  AC-013.1.25 and .4.19 passed on shared Supabase on 3 October (EVT-2026-0015).
- **`removeRequirement` has no service-level test.** Its behaviour is covered by the UI
  tests (with the service mocked) and the database tests.
- **No concurrent-edit protection.** Two browser tabs can overwrite each other's line
  edits. The story does not ask for it, and US7's `review_version` pattern would be the
  model if it is needed.
- **Organiser text is the current value.** "Original equipment needs" is the current
  `events.equipment_requirements`, which includes approved change requests (D7).
