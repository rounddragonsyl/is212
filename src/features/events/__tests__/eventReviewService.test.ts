import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  REVIEW_MESSAGES,
  getEventRequest,
  listEventRequests,
  transitionEventStatus,
} from '../eventReviewService'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from },
}))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'

function mockList(response: { data: unknown[] | null; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(response)
  const neq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ neq }))
  mocks.from.mockReturnValue({ select })
  return { select, neq, order }
}

function mockUpdate(response: {
  data: { id: string; status: string } | null
  error: { message: string } | null
}) {
  const maybeSingle = vi.fn().mockResolvedValue(response)
  const select = vi.fn((_columns: string) => ({ maybeSingle }))
  const eqStatus = vi.fn((_column: string, _value: string) => ({ select }))
  const eqId = vi.fn((_column: string, _value: string) => ({ eq: eqStatus }))
  const update = vi.fn((_values: Record<string, unknown>) => ({ eq: eqId }))
  mocks.from.mockReturnValue({ update })
  return { update, eqId, eqStatus }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listing requests', () => {
  test('drafts are excluded — an unsubmitted draft is the organiser private working copy', async () => {
    const { neq } = mockList({ data: [], error: null })

    await listEventRequests()

    expect(neq).toHaveBeenCalledWith('status', 'draft')
  })

  test('maps database columns onto the shape the UI renders', async () => {
    mockList({
      data: [
        {
          id: EVENT_ID,
          reference: 'EVT-2026-0001',
          organiser_id: 'organiser-1',
          name: 'Client dinner',
          purpose: 'Thank our clients',
          event_type: 'Dinner',
          proposed_start: '2099-06-01T18:00:00Z',
          proposed_end: '2099-06-01T22:00:00Z',
          expected_attendance: 120,
          status: 'submitted',
          submitted_at: '2026-01-05T02:11:00Z',
        },
      ],
      error: null,
    })

    const result = await listEventRequests()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.requests[0]).toMatchObject({
      id: EVENT_ID,
      reference: 'EVT-2026-0001',
      organiserId: 'organiser-1',
      eventType: 'Dinner',
      expectedAttendance: 120,
      status: 'submitted',
    })
  })

  test('a database error is reported to the user without leaking the schema', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockList({ data: null, error: { message: 'column events.review_note does not exist' } })

    const result = await listEventRequests()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.loadFailed)
    // The detail is still available to a developer, just not to the organiser.
    expect(result.reason).not.toContain('review_note')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('reviewing a request', () => {
  const coordinator = { role: 'coordinator', isOwner: false } as const

  test('a coordinator can take a submitted request under review', async () => {
    mockUpdate({ data: { id: EVENT_ID, status: 'under_review' }, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'submitted',
      to: 'under_review',
      actor: coordinator,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('under_review')
  })

  test('an illegal transition is refused before it reaches the database', async () => {
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'submitted',
      to: 'approved',
      actor: coordinator,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.notPermitted)
    expect(update).not.toHaveBeenCalled()
  })

  test('an organiser cannot approve their own request', async () => {
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: { role: 'organiser', isOwner: true },
    })

    expect(result.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  test('a rejection without a reason is refused', async () => {
    // A rejection the organiser cannot act on is not a review.
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'rejected',
      actor: coordinator,
      note: '   ',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.noteRequired)
    expect(update).not.toHaveBeenCalled()
  })

  test('a rejection with a reason records the note', async () => {
    const { update } = mockUpdate({ data: { id: EVENT_ID, status: 'rejected' }, error: null })

    await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'rejected',
      actor: coordinator,
      note: '  The hall is closed for refurbishment that week.  ',
    })

    expect(update).toHaveBeenCalledWith({
      status: 'rejected',
      review_note: 'The hall is closed for refurbishment that week.',
    })
  })

  test('the update is scoped to the status we believe the request is in', async () => {
    // Optimistic concurrency: if another coordinator has moved it, we must not overwrite them.
    const { eqStatus } = mockUpdate({ data: { id: EVENT_ID, status: 'approved' }, error: null })

    await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: coordinator,
    })

    expect(eqStatus).toHaveBeenCalledWith('status', 'under_review')
  })

  test('a request another coordinator has already moved is reported, not overwritten', async () => {
    mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: coordinator,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.illegalTransition)
  })
})


describe('SCRUM-24 organiser reads', () => {
  test('AC-24.1: includes drafts when listing organiser requests', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const neq = vi.fn()
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ order, neq }) })
    expect(await listEventRequests(true)).toEqual({ ok: true, requests: [] })
    expect(neq).not.toHaveBeenCalled()
  })

  test('AC-24.6: forbidden and missing requests share the same response', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })
    expect(await getEventRequest(EVENT_ID)).toEqual({ ok: false, reason: REVIEW_MESSAGES.notFound })
    expect(eq).toHaveBeenCalledWith('id', EVENT_ID)
    expect(select.mock.calls[0][0]).not.toContain('reviewed_by')
    expect(select.mock.calls[0][0]).not.toContain('*')
  })
})
