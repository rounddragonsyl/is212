import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DRAFT_LOAD_MESSAGES, getEventDraft } from '../eventDraftQueryService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const row = {
  id: 'draft-1', organiser_id: 'organiser-1', status: 'draft', updated_at: '2026-09-17T10:00:00Z',
  name: 'Team dinner', purpose: 'Celebrate', event_type: 'Dinner', description: 'Team meal',
  proposed_start: '2030-01-01T10:00:00Z', proposed_end: '2030-01-01T12:00:00Z',
  expected_attendance: 25, programme: 'Welcome', layout_preference: 'Banquet',
  accessibility_requirements: 'Ramp', equipment_requirements: 'Microphone',
  registration_required: true, special_arrangements: 'Vegetarian meals',
}

function mockRead(data: Record<string, unknown> | null = row, error: object | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn(), update: vi.fn(),
  }
  mocks.from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'organiser-1' } }, error: null })
})

describe('Save Draft Event Request — load a draft (mocked Supabase)', () => {
  test('AC 4/5: loads every saved field without writing or submitting', async () => {
    const query = mockRead()
    expect(await getEventDraft('draft-1')).toEqual({
      ok: true,
      draft: {
        id: row.id, status: 'draft', updatedAt: row.updated_at,
        values: {
          name: 'Team dinner', purpose: 'Celebrate', eventType: 'Dinner', description: 'Team meal',
          proposedStart: row.proposed_start, proposedEnd: row.proposed_end, expectedAttendance: 25,
          programme: 'Welcome', layoutPreference: 'Banquet', accessibilityRequirements: 'Ramp',
          equipmentRequirements: 'Microphone', registrationRequired: true, specialArrangements: 'Vegetarian meals',
        },
      },
    })
    expect(mocks.from).toHaveBeenCalledWith('events')
    expect(query.eq.mock.calls).toEqual([
      ['id', 'draft-1'], ['organiser_id', 'organiser-1'], ['status', 'draft'],
    ])
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.update).not.toHaveBeenCalled()
  })

  test('AC 2/4: loads an incomplete draft without applying submission validation', async () => {
    const fields = Object.fromEntries(Object.keys(row).map((key) => [key, null]))
    mockRead({ ...fields, id: row.id, organiser_id: row.organiser_id, status: 'draft', updated_at: row.updated_at })
    const result = await getEventDraft('draft-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.values).toEqual({
      name: '', purpose: '', eventType: '', description: '', proposedStart: '', proposedEnd: '',
      expectedAttendance: '', programme: '', layoutPreference: '', accessibilityRequirements: '',
      equipmentRequirements: '', registrationRequired: false, specialArrangements: '',
    })
  })

  test.each([null, { ...row, status: 'submitted' }, { ...row, organiser_id: 'someone-else' }, { ...row, id: 'different' }])(
    'AC 4: does not expose an unavailable or mismatched draft (%j)', async (data) => {
      mockRead(data)
      expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.unavailable })
    },
  )

  test('AC 4: rejects an empty ID without contacting Supabase', async () => {
    expect(await getEventDraft(' ')).toMatchObject({ ok: false })
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    { data: { user: null }, error: null },
    { data: { user: { id: 'organiser-1' } }, error: { message: 'Expired session' } },
  ])('AC 4: requires a valid signed-in user (%j)', async (session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC 4: reports a database failure without exposing internal details', async () => {
    mockRead(null, { message: 'private schema details' })
    expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed })
  })

  test('AC 4: handles a lost database connection', async () => {
    const query = mockRead()
    query.maybeSingle.mockRejectedValue(new Error('Offline'))
    await expect(getEventDraft('draft-1')).resolves.toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed })
  })

  test('AC 4: handles an authentication exception without querying events', async () => {
    mocks.getUser.mockRejectedValue(new Error('Offline'))
    await expect(getEventDraft('draft-1')).resolves.toMatchObject({ ok: false })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
