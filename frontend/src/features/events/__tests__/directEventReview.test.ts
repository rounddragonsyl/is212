import { beforeEach, expect, test, vi } from 'vitest'
import { transitionEventStatus, REVIEW_MESSAGES } from '../eventReviewService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: mocks }))
beforeEach(() => { vi.resetAllMocks() })
const base = { id: '10000000-0000-0000-0000-000000000001', from: 'submitted' as const,
  actor: { role: 'coordinator' as const, isOwner: false } }

test.each([
  ['AC-004.2.27', 'approved'], ['AC-004.2.28', 'rejected'], ['AC-004.2.29', 'submitted'],
] as const)('%s: a direct %s decision uses one atomic RPC', async (_id, to) => {
  mocks.rpc.mockResolvedValue({ data: to, error: null })
  expect(await transitionEventStatus({ ...base, to, note: '  Explanation  ' })).toEqual({ ok: true, status: to })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(mocks.rpc).toHaveBeenCalledWith('review_submitted_event', {
    p_event_id: base.id, p_decision: to, p_note: 'Explanation',
  })
  expect(mocks.from).not.toHaveBeenCalled()
})
test('AC-004.2.30: a stale submitted request reports failure without a fallback write', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000' } })
  expect(await transitionEventStatus({ ...base, to: 'approved' })).toEqual({ ok: false, reason: REVIEW_MESSAGES.illegalTransition })
  expect(mocks.from).not.toHaveBeenCalled()
})
test.each([
  ['AC-004.3.6', 'submitted'], ['AC-004.3.7', 'rejected'],
] as const)('%s: a direct %s decision requires a reason before contacting the database', async (_id, to) => {
  expect(await transitionEventStatus({ ...base, to, note: ' ' })).toEqual({ ok: false, reason: REVIEW_MESSAGES.noteRequired })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
