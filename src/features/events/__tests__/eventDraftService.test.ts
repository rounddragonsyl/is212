import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DRAFT_MESSAGES, saveEventDraft } from '../eventDraftService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const ORGANISER_ID = '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11'
const savedRow = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  status: 'draft',
  updated_at: '2026-09-17T10:00:00Z',
}

function mockWrite(response: {
  data: typeof savedRow | null
  error: { code: string; message?: string } | null
}) {
  const query = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
  }
  mocks.from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: ORGANISER_ID } }, error: null })
})

describe('Save Draft Event Request — saving drafts (mocked Supabase)', () => {
  test('AC 1/2/5: saves an empty request as draft for the signed-in owner', async () => {
    const query = mockWrite({ data: savedRow, error: null })
    expect(await saveEventDraft({})).toEqual({
      ok: true,
      draft: { id: savedRow.id, status: 'draft', updatedAt: savedRow.updated_at },
    })
    expect(mocks.from).toHaveBeenCalledWith('events')
    expect(query.insert).toHaveBeenCalledWith({
      organiser_id: ORGANISER_ID, status: 'draft', name: null, purpose: null,
      event_type: null, description: null, proposed_start: null, proposed_end: null,
      expected_attendance: null, programme: null, layout_preference: null,
      accessibility_requirements: null, equipment_requirements: null,
      registration_required: false, special_arrangements: null,
    })
    expect(query.update).not.toHaveBeenCalled()
  })

  test('AC 1: maps every supplied field to the existing database column', async () => {
    const query = mockWrite({ data: savedRow, error: null })
    await saveEventDraft({
      name: ' Dinner ', purpose: 'Celebrate', eventType: 'Dinner', description: 'Team meal',
      proposedStart: '2030-01-01T18:00:00+08:00', proposedEnd: '2030-01-01T20:00:00+08:00',
      expectedAttendance: '25', programme: 'Welcome', layoutPreference: 'Banquet',
      accessibilityRequirements: 'Ramp', equipmentRequirements: 'Microphone',
      registrationRequired: true, specialArrangements: 'Vegetarian meals',
    })
    expect(query.insert).toHaveBeenCalledWith({
      organiser_id: ORGANISER_ID, status: 'draft', name: 'Dinner', purpose: 'Celebrate',
      event_type: 'Dinner', description: 'Team meal',
      proposed_start: '2030-01-01T10:00:00.000Z', proposed_end: '2030-01-01T12:00:00.000Z',
      expected_attendance: 25, programme: 'Welcome', layout_preference: 'Banquet',
      accessibility_requirements: 'Ramp', equipment_requirements: 'Microphone',
      registration_required: true, special_arrangements: 'Vegetarian meals',
    })
  })

  test('AC 4/5: updates only the matching owned draft without changing workflow fields', async () => {
    const query = mockWrite({ data: savedRow, error: null })
    const result = await saveEventDraft({ name: 'Updated name', purpose: '' }, savedRow.id)
    expect(result.ok).toBe(true)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.eq.mock.calls).toEqual([
      ['id', savedRow.id], ['organiser_id', ORGANISER_ID], ['status', 'draft'],
    ])
    const fields = query.update.mock.calls[0][0]
    expect(fields).toMatchObject({ name: 'Updated name', purpose: null })
    for (const key of ['status', 'reference', 'submitted_at', 'organiser_id', 'review_note']) {
      expect(fields).not.toHaveProperty(key)
    }
  })

  test('AC 4/5: reports an unavailable draft without inserting a replacement', async () => {
    const query = mockWrite({ data: null, error: null })
    expect(await saveEventDraft({}, savedRow.id)).toEqual({
      ok: false, reason: DRAFT_MESSAGES.unavailable, issues: [],
    })
    expect(query.insert).not.toHaveBeenCalled()
  })

  test('AC 1: rejects invalid details before contacting Supabase', async () => {
    const result = await saveEventDraft({ expectedAttendance: -1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0].field).toBe('expectedAttendance')
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC 4: a blank existing ID cannot accidentally create a new draft', async () => {
    expect(await saveEventDraft({}, '')).toMatchObject({ ok: false })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    { data: { user: null }, error: null },
    { data: { user: { id: ORGANISER_ID } }, error: { message: 'Expired session' } },
  ])('AC 1: refuses saving without a valid signed-in user (%j)', async (session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await saveEventDraft({})).toEqual({
      ok: false, reason: DRAFT_MESSAGES.notSignedIn, issues: [],
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    ['42501', DRAFT_MESSAGES.notPermitted],
    ['23503', DRAFT_MESSAGES.unknownOrganiser],
    ['23514', DRAFT_MESSAGES.invalidDetails],
    ['unknown', DRAFT_MESSAGES.saveFailed],
  ])('AC 1: translates database error %s into an actionable message', async (code, reason) => {
    mockWrite({ data: null, error: { code, message: 'Internal database details' } })
    expect(await saveEventDraft({})).toEqual({ ok: false, reason, issues: [] })
  })

  test.each([null, { ...savedRow, status: 'submitted' }])(
    'AC 1/5: does not report success for an absent or non-draft response (%j)', async (data) => {
      mockWrite({ data, error: null })
      expect(await saveEventDraft({})).toEqual({
        ok: false, reason: DRAFT_MESSAGES.saveFailed, issues: [],
      })
    },
  )

  test('AC 1: handles an authentication network exception', async () => {
    mocks.getUser.mockRejectedValue(new Error('Connection lost'))
    await expect(saveEventDraft({})).resolves.toMatchObject({ ok: false, reason: DRAFT_MESSAGES.saveFailed })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC 1: handles a lost save response without retrying the insert', async () => {
    const query = mockWrite({ data: null, error: null })
    query.maybeSingle.mockRejectedValue(new Error('Connection lost'))
    await expect(saveEventDraft({})).resolves.toMatchObject({ ok: false, reason: DRAFT_MESSAGES.saveFailed })
    expect(query.insert).toHaveBeenCalledTimes(1)
  })
})
