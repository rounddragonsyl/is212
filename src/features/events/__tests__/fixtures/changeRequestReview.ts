import type { ChangeRequestReviewContext, EventChangeRequest } from '../../types'

export const eventId = '10000000-0000-0000-0000-000000000001'
export const coordinatorId = '00000000-0000-0000-0000-000000000003'
export const changeRequest: EventChangeRequest = {
  id: '20000000-0000-0000-0000-000000000001', eventId,
  proposedChanges: { name: 'New title', expectedAttendance: '80' },
  reason: 'We expect more guests.', status: 'submitted', submittedAt: '2026-09-25T01:00:00Z',
  reviewedAt: null, reviewNote: null, fieldDecisions: [],
}
export const reviewContext: ChangeRequestReviewContext = {
  eventId, eventStatus: 'confirmed', eventUpdatedAt: '2026-09-25T01:00:00.123456+00:00',
  currentValues: { name: 'Original title', expectedAttendance: 50 }, requests: [changeRequest],
}
export const changeRequestRow = {
  id: changeRequest.id, event_id: eventId, proposed_changes: changeRequest.proposedChanges,
  reason: changeRequest.reason, status: changeRequest.status, submitted_at: changeRequest.submittedAt,
  reviewed_at: null, review_note: null, field_decisions: null,
}
