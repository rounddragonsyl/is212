import { beforeEach, expect, test, vi } from 'vitest'
import { requestEventChange, CHANGE_REQUEST_MESSAGES, LOCKED_STATUSES } from '../eventChangeRequestService'
import { changeRequest, eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))

const proposedChanges = changeRequest.proposedChanges
const reason = changeRequest.reason

function eventStatusQuery(status: string | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: status ? { status } : null, error }),
  }
}
function pendingCheckQuery(existing: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error }),
  }
}
function insertQuery(data: unknown, error: unknown = null) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'organiser-1' } }, error: null })
})

test('AC-006.2.1: creates a change request and never writes to the events table', async () => {
  const insertChain = insertQuery({ id: changeRequest.id })
  mocks.from
    .mockReturnValueOnce(eventStatusQuery('submitted'))
    .mockReturnValueOnce(pendingCheckQuery(null))
    .mockReturnValueOnce(insertChain)

  const result = await requestEventChange(eventId, proposedChanges, reason)

  expect(result).toEqual({ ok: true, requestId: changeRequest.id })
  expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
    event_id: eventId, organiser_id: 'organiser-1', proposed_changes: proposedChanges,
    reason, status: 'submitted',
  }))
  const eventsCalls = mocks.from.mock.calls.filter(([table]) => table === 'events')
  expect(eventsCalls).toHaveLength(1)
})

test('AC-006.2.2: refuses to create a request when no user session is present', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  const result = await requestEventChange(eventId, proposedChanges, reason)
  expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn })
  expect(mocks.from).not.toHaveBeenCalled()
})

test('AC-006.2.3: a blank reason is refused before any database call', async () => {
  const result = await requestEventChange(eventId, proposedChanges, '   ')
  expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.reasonRequired })
  expect(mocks.from).not.toHaveBeenCalled()
})

test('AC-006.2.4: an empty set of proposed changes is refused before any database call', async () => {
  const result = await requestEventChange(eventId, {}, reason)
  expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
  expect(mocks.from).not.toHaveBeenCalled()
})

test('AC-006.2.5: a second pending request on the same event is refused', async () => {
  mocks.from
    .mockReturnValueOnce(eventStatusQuery('submitted'))
    .mockReturnValueOnce(pendingCheckQuery({ id: 'existing-pending' }))

  const result = await requestEventChange(eventId, proposedChanges, reason)
  expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.alreadyPending })
})

// AC-006.5 — status guard. Written against LOCKED_STATUSES as currently implemented
// (confirmed/cancelled/rejected). If the AC is actually Cancelled/Completed/Rejected as
// written in the backlog, LOCKED_STATUSES needs to change in eventChangeRequestService.ts
// and this list needs to change with it — confirm with the team before treating this as final.
test.each(LOCKED_STATUSES.map((status) => [status] as const))(
  'AC-006.5.%$: blocks a change request when the event status is %s',
  async (status) => {
    mocks.from.mockReturnValueOnce(eventStatusQuery(status))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.eventLocked })
  },
)

test('AC-006.5.4: an event that could not be found is refused rather than silently allowed', async () => {
  mocks.from.mockReturnValueOnce(eventStatusQuery(null))
  const result = await requestEventChange(eventId, proposedChanges, reason)
  expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.eventNotFound })
})

// AC-006.7 — the audit trail is structural, not a separate log call: organiser_id comes
// from the authenticated session (never the client-supplied payload), and submitted_at is
// left for the database's own default rather than sent from here. Together these are "who
// requested it and when" without the client being trusted to state either fact itself.
test('AC-006.7.1: identifies who requested the change without trusting a client-supplied timestamp', async () => {
  const insertChain = insertQuery({ id: changeRequest.id })
  mocks.from
    .mockReturnValueOnce(eventStatusQuery('submitted'))
    .mockReturnValueOnce(pendingCheckQuery(null))
    .mockReturnValueOnce(insertChain)

  await requestEventChange(eventId, proposedChanges, reason)

  const insertedRow = insertChain.insert.mock.calls[0][0]
  expect(insertedRow.organiser_id).toBe('organiser-1')
  expect(insertedRow).not.toHaveProperty('submitted_at')
  expect(insertedRow).not.toHaveProperty('created_at')
})