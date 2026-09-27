import { beforeEach, expect, test, vi } from 'vitest'
import { saveChangeRequestReply, CHANGE_REPLY_SERVICE_MESSAGES as messages } from '../changeRequestReplyService'
import { changeRequest } from './fixtures/changeRequestReview'
import type { EventChangeRequest } from '../types'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
const request: EventChangeRequest = {
  ...changeRequest, status: 'clarification_requested', reviewVersion: 3,
  fieldDecisions: [
    { field: 'name', decision: 'approved', note: '' },
    { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Includes staff?' },
  ],
}
const input = { replies: [{ field: 'expectedAttendance', message: '  Yes.  ' }] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  mocks.rpc.mockResolvedValue({ data: 'submitted', error: null })
})
test('AC-007.7.48: sends trimmed answers and the displayed request version without client actor or event values', async () => {
  expect(await saveChangeRequestReply(request, input)).toEqual({ ok: true, status: 'submitted' })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(mocks.rpc).toHaveBeenCalledWith('reply_to_change_request', {
    p_request_id: request.id, p_request_version: 3,
    p_reply: { replies: [{ field: 'expectedAttendance', message: 'Yes.' }] },
  })
})
test('AC-007.7.49: incomplete answers never reach the database', async () => {
  expect((await saveChangeRequestReply(request, { replies: [] })).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-007.7.50: missing request version requires reloading before writing', async () => {
  expect(await saveChangeRequestReply({ ...request, reviewVersion: undefined }, input)).toEqual({ ok: false, reason: messages.reload })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-007.7.51: a missing session cannot submit answers', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await saveChangeRequestReply(request, input)).toEqual({ ok: false, reason: messages.unavailable })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test.each([
  ['AC-007.7.52', '22000', messages.reload],
  ['AC-007.7.53', '23505', messages.pending],
  ['AC-007.7.54', '42501', messages.unavailable],
])('%s: maps a database rejection to an actionable message', async (_id, code, reason) => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'private details' } })
  expect(await saveChangeRequestReply(request, input)).toEqual({ ok: false, reason })
})
test('AC-007.7.55: a lost response does not automatically resubmit the reply', async () => {
  mocks.rpc.mockRejectedValue(new Error('Offline'))
  expect(await saveChangeRequestReply(request, input)).toEqual({ ok: false, reason: messages.failed })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
test('AC-007.7.56: an unexpected response is not reported as a successful reply', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await saveChangeRequestReply(request, input)).toEqual({ ok: false, reason: messages.failed })
})
