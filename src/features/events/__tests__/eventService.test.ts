import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SERVICE_MESSAGES, submitEventRequest } from '../eventService'
import { VALIDATION_MESSAGES } from '../validation'
import { EVENT_STATUS_LABELS } from '../types'
import type { EventRequestInput } from '../types'

// vi.hoisted, because vi.mock is hoisted above these declarations and the factory would
// otherwise close over variables that do not exist yet.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}))

// The service is the only seam onto Supabase, so stubbing this one module is enough to
// test the whole submission path without a database.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

const ORGANISER_ID = '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11'

// Far enough out that the suite does not start failing the day the date passes.
const validInput: EventRequestInput = {
  name: 'Client Appreciation Dinner',
  purpose: 'Thank our largest clients and announce next year’s programme',
  proposedStart: '2099-06-01T18:00',
  proposedEnd: '2099-06-01T22:00',
  expectedAttendance: '120',
}

interface InsertedRow {
  id: string
  reference: string | null
  status: string
  submitted_at: string | null
}

interface PostgrestError {
  code?: string
  message?: string
}

function mockInsert(response: { data: InsertedRow | null; error: PostgrestError | null }) {
  const single = vi.fn().mockResolvedValue(response)
  const select = vi.fn((_columns: string) => ({ single }))
  // The payload is typed so assertions about what we send the database are typechecked.
  const insert = vi.fn((_row: Record<string, unknown>) => ({ select }))
  mocks.from.mockReturnValue({ insert })
  return { insert, select, single }
}

const submittedRow: InsertedRow = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2026-0042',
  status: 'submitted',
  submitted_at: '2026-01-05T02:11:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: ORGANISER_ID } }, error: null })
})

describe('AC-005.3 / AC-005.5 — successful submission', () => {
  test('AC-005.5: a successful submission returns a unique reference in EVT-YYYY-NNNN form', async () => {
    mockInsert({ data: submittedRow, error: null })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.reference).toMatch(/^EVT-\d{4}-\d{4}$/)
  })

  test('AC-005.5: a successful submission is stored with status "Submitted"', async () => {
    mockInsert({ data: submittedRow, error: null })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.status).toBe('submitted')
    expect(EVENT_STATUS_LABELS[result.event.status]).toBe('Submitted')
    expect(result.event.submittedAt).toBe('2026-01-05T02:11:00.000Z')
  })

  test('AC-005.5: the client sends status submitted but never a reference of its own', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })

    await submitEventRequest(validInput)

    const payload = insert.mock.calls[0][0]
    expect(payload.status).toBe('submitted')
    expect(payload).not.toHaveProperty('reference')
    expect(payload).not.toHaveProperty('submitted_at')
  })

  test('AC-005.5: the request is filed against the signed-in organiser', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })

    await submitEventRequest(validInput)

    const payload = insert.mock.calls[0][0]
    expect(payload.organiser_id).toBe(ORGANISER_ID)
    expect(mocks.from).toHaveBeenCalledWith('events')
  })

  test('AC-005.1: optional details the organiser omitted are stored as null, not empty strings', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })

    await submitEventRequest({ ...validInput, programme: '   ' })

    const payload = insert.mock.calls[0][0]
    expect(payload.programme).toBeNull()
    expect(payload.equipment_requirements).toBeNull()
    expect(payload.registration_required).toBe(false)
  })
})

describe('AC-005.4 — failed submission reports a specific reason', () => {
  test('AC-005.4: an invalid request is rejected with the failing rule, not a generic message', async () => {
    const { insert } = mockInsert({ data: null, error: null })

    const result = await submitEventRequest({ ...validInput, purpose: '   ' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain(VALIDATION_MESSAGES.purposeRequired)
    expect(result.issues).toEqual([
      { field: 'purpose', message: VALIDATION_MESSAGES.purposeRequired },
    ])
    // Nothing invalid should ever reach the database.
    expect(insert).not.toHaveBeenCalled()
  })

  test('AC-005.4: a submission without a signed-in user explains that sign-in is required', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { insert } = mockInsert({ data: null, error: null })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.notSignedIn)
    expect(insert).not.toHaveBeenCalled()
  })

  test('AC-005.4: a row-level-security refusal is reported as a permission problem', async () => {
    mockInsert({ data: null, error: { code: '42501', message: 'new row violates policy' } })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.rlsDenied)
  })

  test('AC-005.4: a database CHECK violation is reported without leaking the constraint name', async () => {
    mockInsert({
      data: null,
      error: { code: '23514', message: 'violates check constraint "submitted_requires_core_fields"' },
    })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.constraintViolation)
    expect(result.reason).not.toContain('submitted_requires_core_fields')
  })

  test('AC-005.4: a missing organiser profile is reported as a profile problem', async () => {
    mockInsert({ data: null, error: { code: '23503', message: 'foreign key violation' } })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.unknownOrganiser)
  })

  test('AC-005.4: an unrecognised database error gives advice, not raw Postgres text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInsert({
      data: null,
      error: { code: '42703', message: 'column events.review_note does not exist' },
    })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.unexpected)
    expect(result.reason).not.toContain('review_note')
    // Still recorded where a developer will find it.
    expect(console.error).toHaveBeenCalled()
  })

  test('AC-005.5: a saved row that came back without a reference is treated as a failure', async () => {
    mockInsert({ data: { ...submittedRow, reference: null }, error: null })

    const result = await submitEventRequest(validInput)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.missingReference)
  })
})
