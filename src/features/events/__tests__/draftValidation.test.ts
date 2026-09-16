import { describe, expect, test } from 'vitest'
import { validateEventDraft } from '../draftValidation'
import { validateEventRequest, VALIDATION_MESSAGES } from '../validation'

describe('Save Draft Event Request — incomplete drafts', () => {
  test('AC 2: accepts an empty draft and normalises missing fields', () => {
    expect(validateEventDraft({})).toEqual({ ok: true, value: {
      name: null, purpose: null, eventType: null, description: null,
      proposedStart: null, proposedEnd: null, expectedAttendance: null,
      programme: null, layoutPreference: null, accessibilityRequirements: null,
      equipmentRequirements: null, registrationRequired: false, specialArrangements: null,
    } })
  })

  test('AC 2: trims supplied text and treats blank inputs as missing', () => {
    const result = validateEventDraft({ name: '  Team dinner  ', purpose: '  ',
      proposedStart: '', proposedEnd: ' ', expectedAttendance: ' ', registrationRequired: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ name: 'Team dinner', purpose: null,
      proposedStart: null, proposedEnd: null, expectedAttendance: null, registrationRequired: true })
  })

  test.each(['proposedStart', 'proposedEnd'] as const)('AC 2: permits only %s to be filled', (field) => {
    const date = '2030-01-01T10:00:00+08:00'
    const result = validateEventDraft({ [field]: date })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[field]).toEqual(new Date(date))
  })

  test.each(['proposedStart', 'proposedEnd'] as const)('AC 2: rejects invalid supplied %s', (field) => {
    const result = validateEventDraft({ [field]: 'not a date' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual([{ field, message: field === 'proposedStart'
      ? VALIDATION_MESSAGES.startInvalid : VALIDATION_MESSAGES.endInvalid }])
  })

  test.each(['2026-01-01T09:00:00Z', '2026-01-01T10:00:00Z'])(
    'AC 2: rejects supplied end %s at or before start', (proposedEnd) => {
      expect(validateEventDraft({ proposedStart: '2026-01-01T10:00:00Z', proposedEnd }))
        .toEqual({ ok: false, issues: [{ field: 'proposedEnd', message: VALIDATION_MESSAGES.endBeforeStart }] })
    },
  )

  test.each([0, -1, '12.5', 'many', Infinity, NaN, 2147483648])(
    'AC 2: rejects attendance %s that cannot be stored', (expectedAttendance) => {
      const result = validateEventDraft({ expectedAttendance })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].field).toBe('expectedAttendance')
    },
  )

  test.each([1, ' 120 ', 2147483647])('AC 2: accepts valid attendance %s', (expectedAttendance) => {
    const result = validateEventDraft({ expectedAttendance })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expectedAttendance).toBe(Number(expectedAttendance))
  })

  test('AC 2: reports multiple invalid fields together', () => {
    const result = validateEventDraft({ proposedStart: 'bad', proposedEnd: 'bad', expectedAttendance: -1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map(({ field }) => field)).toEqual(['proposedStart', 'proposedEnd', 'expectedAttendance'])
  })

  test('AC 2/6: saving permits old dates while submission still rejects them', () => {
    const input = { purpose: 'Dinner', expectedAttendance: '1',
      proposedStart: '2020-01-01T10:00:00Z', proposedEnd: '2020-01-01T10:00:01Z' }
    expect(validateEventDraft(input).ok).toBe(true)
    expect(validateEventRequest(input, { now: new Date('2026-01-01T00:00:00Z') }).ok).toBe(false)
    expect(validateEventRequest({}).ok).toBe(false)
  })
})
