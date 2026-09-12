import { describe, expect, test } from 'vitest'
import { VALIDATION_MESSAGES, validateEventRequest } from '../validation'
import type { EventRequestInput, ValidationIssue } from '../types'

// A fixed clock, so "in the past" means the same thing in June as it does in January.
const NOW = new Date('2026-01-01T09:00:00Z')

const validInput: EventRequestInput = {
  purpose: 'Annual client appreciation dinner',
  proposedStart: '2026-03-01T18:00',
  proposedEnd: '2026-03-01T22:00',
  expectedAttendance: '120',
}

const validate = (overrides: Partial<EventRequestInput> = {}) =>
  validateEventRequest({ ...validInput, ...overrides }, { now: NOW })

const messageFor = (issues: ValidationIssue[], field: ValidationIssue['field']) =>
  issues.find((issue) => issue.field === field)?.message

describe('AC-005.2 — required fields', () => {
  test('AC-005.2: rejects submission when purpose is missing', () => {
    const result = validate({ purpose: undefined })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'purpose')).toBe(VALIDATION_MESSAGES.purposeRequired)
  })

  test('AC-005.2: rejects submission when purpose is whitespace only', () => {
    const result = validate({ purpose: '    ' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'purpose')).toBe(VALIDATION_MESSAGES.purposeRequired)
  })

  test('AC-005.2: rejects submission when the preferred start date and time is missing', () => {
    const result = validate({ proposedStart: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedStart')).toBe(VALIDATION_MESSAGES.startRequired)
  })

  test('AC-005.2: rejects submission when the preferred end date and time is missing', () => {
    const result = validate({ proposedEnd: undefined })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedEnd')).toBe(VALIDATION_MESSAGES.endRequired)
  })

  test('AC-005.2: rejects submission when expected attendance is missing', () => {
    const result = validate({ expectedAttendance: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'expectedAttendance')).toBe(
      VALIDATION_MESSAGES.attendanceRequired,
    )
  })

  test('AC-005.2: reports every missing required field at once, not just the first', () => {
    const result = validateEventRequest({}, { now: NOW })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.field).sort()).toEqual([
      'expectedAttendance',
      'proposedEnd',
      'proposedStart',
      'purpose',
    ])
  })
})

describe('AC-005.2 — invalid values', () => {
  test('AC-005.2: rejects an expected attendance of 0 (lower boundary, invalid)', () => {
    const result = validate({ expectedAttendance: '0' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'expectedAttendance')).toBe(
      VALIDATION_MESSAGES.attendancePositive,
    )
  })

  test('AC-005.2: rejects a negative expected attendance of -1', () => {
    const result = validate({ expectedAttendance: '-1' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'expectedAttendance')).toBe(
      VALIDATION_MESSAGES.attendancePositive,
    )
  })

  test('AC-005.2: accepts an expected attendance of 1 (lower boundary, valid)', () => {
    const result = validate({ expectedAttendance: '1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expectedAttendance).toBe(1)
  })

  test('AC-005.2: rejects a non-numeric expected attendance', () => {
    const result = validate({ expectedAttendance: 'a lot' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'expectedAttendance')).toBe(
      VALIDATION_MESSAGES.attendanceNumeric,
    )
  })

  test('AC-005.2: rejects a fractional expected attendance', () => {
    const result = validate({ expectedAttendance: '12.5' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'expectedAttendance')).toBe(
      VALIDATION_MESSAGES.attendanceNumeric,
    )
  })

  test('AC-005.2: rejects an end date and time before the start', () => {
    const result = validate({
      proposedStart: '2026-03-01T18:00',
      proposedEnd: '2026-03-01T17:00',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedEnd')).toBe(VALIDATION_MESSAGES.endBeforeStart)
  })

  test('AC-005.2: rejects a zero-length event where end equals start (boundary)', () => {
    const result = validate({
      proposedStart: '2026-03-01T18:00',
      proposedEnd: '2026-03-01T18:00',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedEnd')).toBe(VALIDATION_MESSAGES.endBeforeStart)
  })

  test('AC-005.2: rejects a proposed start date in the past', () => {
    const result = validate({
      proposedStart: '2025-12-31T18:00',
      proposedEnd: '2025-12-31T22:00',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedStart')).toBe(VALIDATION_MESSAGES.startInPast)
  })

  test('AC-005.2: rejects an unparseable date', () => {
    const result = validate({ proposedStart: 'next Tuesday-ish' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'proposedStart')).toBe(VALIDATION_MESSAGES.startInvalid)
  })
})

describe('AC-005.1 — optional information', () => {
  test('AC-005.1: accepts a request with every optional field omitted', () => {
    const result = validate()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.purpose).toBe('Annual client appreciation dinner')
    expect(result.value.programme).toBeNull()
    expect(result.value.accessibilityRequirements).toBeNull()
    expect(result.value.registrationRequired).toBe(false)
  })

  test('AC-005.1: captures every optional field when the organiser supplies them', () => {
    const result = validate({
      name: 'Client Appreciation Dinner 2026',
      eventType: 'Gala dinner',
      description: 'Evening reception followed by dinner and awards.',
      programme: '18:00 reception, 19:00 dinner, 21:00 awards',
      layoutPreference: 'Banquet',
      accessibilityRequirements: 'Step-free access and a hearing loop',
      equipmentRequirements: 'Stage lighting, two radio microphones',
      registrationRequired: true,
      specialArrangements: 'Kosher and halal menu options',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      name: 'Client Appreciation Dinner 2026',
      eventType: 'Gala dinner',
      layoutPreference: 'Banquet',
      registrationRequired: true,
      specialArrangements: 'Kosher and halal menu options',
    })
  })

  test('AC-005.1: collapses whitespace-only optional fields to null rather than storing blanks', () => {
    const result = validate({ programme: '   ', layoutPreference: '' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.programme).toBeNull()
    expect(result.value.layoutPreference).toBeNull()
  })

  test('AC-005.1: trims surrounding whitespace from the purpose before storing it', () => {
    const result = validate({ purpose: '  Team offsite  ' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.purpose).toBe('Team offsite')
  })
})
