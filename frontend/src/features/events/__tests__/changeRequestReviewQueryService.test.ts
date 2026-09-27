import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CHANGE_REVIEW_LOAD_MESSAGES as messages, getChangeRequestReviewContext } from '../changeRequestReviewQueryService'
import { changeRequestRow, coordinatorId, eventId, reviewContext, replyRound } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))
const row = {
  id: eventId, coordinator_id: coordinatorId, status: 'confirmed', updated_at: reviewContext.eventUpdatedAt,
  name: 'Original title', purpose: 'Meet', event_type: 'Conference', description: null,
  proposed_start: '2030-01-01T01:00:00Z', proposed_end: '2030-01-01T02:00:00Z', expected_attendance: 50,
  programme: 'Welcome', layout_preference: 'Theatre', accessibility_requirements: 'Ramp',
  equipment_requirements: 'Projector', registration_required: false, special_arrangements: null,
  event_change_requests: [changeRequestRow],
}
function query(data: unknown = row, error: unknown = null) {
  const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) }
  mocks.from.mockReturnValue(read)
  return read
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: coordinatorId } }, error: null })
})

describe('AC-007.2 — load assigned reviews only', () => {
  test.each([
    ['AC-007.2.24', { data: { user: null }, error: null }],
    ['AC-007.2.25', { data: { user: { id: coordinatorId } }, error: { message: 'Expired' } }],
  ])('%s: signed-out or expired sessions cannot load the comparison', async (_id, session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.unavailable })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  test.each([
    ['AC-007.2.26', null], ['AC-007.2.27', { ...row, coordinator_id: 'someone-else' }],
  ])('%s: missing or differently assigned events expose no review data', async (_id, data) => {
    query(data)
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.unavailable })
  })
  test('AC-007.2.28: an invalid event ID does not contact Supabase', async () => {
    expect(await getChangeRequestReviewContext('invalid')).toEqual({ ok: false, reason: messages.unavailable })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
})

describe('AC-007.3 — comparison data', () => {
  test('AC-007.3.1: loads current values, version and field decisions in one assignment-filtered query', async () => {
    const decision = { field: 'name', decision: 'clarification_requested', note: 'Which title?' }
    const read = query({ ...row, event_change_requests: [
      changeRequestRow,
      { ...changeRequestRow, id: 'newer', review_version: 4, reply_history: [replyRound], submitted_at: '2026-09-26T01:00:00Z', field_decisions: [decision] },
    ] })
    const result = await getChangeRequestReviewContext(eventId)
    expect(result).toMatchObject({ ok: true, context: {
      eventUpdatedAt: reviewContext.eventUpdatedAt, eventStatus: 'confirmed',
      currentValues: { name: 'Original title', expectedAttendance: 50, registrationRequired: false, description: '' },
      requests: [{ id: 'newer', reviewVersion: 4, replyHistory: [replyRound], fieldDecisions: [decision] }, { id: changeRequestRow.id, fieldDecisions: [] }],
    } })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(read.select.mock.calls[0][0]).toContain('event_change_requests(')
    expect(read.eq.mock.calls).toEqual([['id', eventId], ['coordinator_id', coordinatorId]])
  })
  test('AC-007.3.2: database failures are not returned as an empty request list', async () => {
    query(null, { message: 'private schema details' })
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.failed })
  })
  test('AC-007.3.3: a lost connection returns a recoverable loading error', async () => {
    query().maybeSingle.mockRejectedValue(new Error('Offline'))
    await expect(getChangeRequestReviewContext(eventId)).resolves.toEqual({ ok: false, reason: messages.failed })
  })
})
