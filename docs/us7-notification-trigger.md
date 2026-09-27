# US7 coordinator notification trigger (SCRUM-54 / AC1)

Scope agreed with Jaydon: implement the submission trigger, not a shared notification
centre or a new email sender. Customer thread #37 requires in-app/email channels and
configuration by notification type. This step provides the records and configuration;
end-user delivery still needs integration/verification before AC1 is called complete.

## Changes

- backend/supabase/migrations/0016_change_request_notifications.sql adds two protected
  tables and an AFTER INSERT/UPDATE trigger. Only new submitted requests or clarification
  replies returning to submitted create notifications. Other updates/review outcomes do not.
- change_request_notifications records the assigned coordinator, event/request IDs, request
  version and creation time. A unique request/version/recipient key prevents duplicates.
- change_request_notification_settings has one type, change_request_submitted, with
  in_app_enabled=true and email_enabled=false by default. This is US7-specific configuration,
  not an administration UI or a replacement for a future shared notification system.
- When email is enabled by an administrator, the trigger uses the existing notification_outbox.
  Its nullable decision_id allows this without altering the US4 schema or sender. The
  existing send-review-notifications function/webhook still needs to be configured/deployed
  for messages to be sent. No email provider secrets belong in browser configuration.
- Email body is generic and directs the coordinator to their current requests, so it does
  not disclose event/proposal details after reassignment. A queued email is addressed to
  the coordinator at submission time; it is not rerouted after reassignment.
- Read permissions expose in-app records only to the recipient who is still the assigned
  coordinator. Browser roles cannot create/edit notifications or change settings.
- Submission and notification persistence are atomic. Failure to store a notification
  rolls back the submission/reply; an email transport failure happens later in the sender.
- Missing coordinator: no broadcast, no notification; submission remains possible. US17's
  assignment workflow must handle notifications/backlog for later assignment. No backfill
  or reassignment trigger is added here. Missing recipient email skips email but retains
  the delivery record. Changing settings affects future submissions, not old records.
- backend/supabase/tests/change_request_notifications.sql and the runner add the checks
  below. README/CLAUDE record scope and integration. No frontend or email sender code changed.

## New database tests

| ID | Check |
| --- | --- |
| AC-007.1.1 | Submission creates a record for the assigned coordinator. |
| AC-007.1.2 | Another coordinator cannot read it. |
| AC-007.1.3 | Organiser cannot read it. |
| AC-007.1.4 | Browser cannot redirect/change notifications. |
| AC-007.1.5 | Browser cannot change channel settings. |
| AC-007.1.6 | Email is off by default while in-app records remain enabled. |
| AC-007.1.7 | Enabled email queues through the existing outbox for the correct recipient. |
| AC-007.1.8 | Both channels disabled means no new record. |
| AC-007.1.9 | Email-only records stay out of in-app reads. |
| AC-007.1.10 | Unassigned requests are not broadcast. |
| AC-007.1.11 | Clarification reply creates a new versioned notification. |
| AC-007.1.12 | Unrelated updates do not duplicate notifications. |
| AC-007.1.13 | Withdrawal does not create a submission notification. |
| AC-007.1.14 | Record-write failure fails the submission transaction. |
| AC-007.1.15 | Failed notification leaves no submitted request. |
| AC-007.1.16 | Reassignment removes previous coordinator's read access. |
| AC-007.1.17 | Actual authenticated organiser insert, with database-generated ID, notifies the new assigned coordinator. |
| AC-007.1.18 | Replaying migration preserves rows and settings (runner). |

Tests use a disposable PostgreSQL container. Deterministic ID fixtures are inserted by
an owner-only temporary test helper, while RLS reads/writes use authenticated roles.
Case 17 also tests the actual permitted browser INSERT shape. Email assertions inspect
outbox rows only; no sender is invoked and no live emails are sent.

Verification: all **132 database checks passed**, including these 18 new cases.
No frontend or sender code changed, so application tests were not rerun for this SQL-only step.

## Deployment and handoff

0016 has not been applied to shared Supabase. Review it before applying after 0015.
Default email=false means applying it does not enable US7 emails. Existing US4 emails are
unchanged. To verify the trigger, submit a NEW change request on an assigned test event;
inspect change_request_notifications for its request ID and correct recipient. Also answer
an outstanding clarification and check the new review version produces another record.

In-app owner: read authorised records (in_app_enabled=true), link event_id to /requests/:id,
then decide UI/refresh/read-state conventions with the team. No notification panel/read-state
API is implemented here. Do not claim that a coordinator has seen a notification from a row alone.

Email owner: configure the existing sender/webhook, then deliberately enable email_enabled
for change_request_submitted in this US7 settings table and verify delivery with test accounts.
This sends notifications to actual account email addresses on later submissions; enable only
when the team is ready. Sent-email delivery is not verified by these database tests.

SCRUM-54 can go to In Review after trigger verification and teammate review. US7 AC1 still
needs visible/delivered notification evidence; the full retained review-decision history also
remains unfinished. The team has not confirmed ownership of the shared notification system.
