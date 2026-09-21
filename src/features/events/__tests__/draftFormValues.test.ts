import { describe, expect, test } from 'vitest'
import { draftFormValues, toDateTimeInput } from '../draftFormValues'

describe('AC-001.4', () => {
  test("AC-001.4.21: restored dates preserve their instant and precision", () => {
    const timestamp = '2030-06-01T10:30:45.123Z'
    expect(new Date(toDateTimeInput(timestamp)).toISOString()).toBe(timestamp)
  })

  test("AC-001.4.22: missing dates remain empty (also AC-001.2)", () => {
    expect(toDateTimeInput()).toBe('')
    expect(toDateTimeInput('')).toBe('')
  })

  test("AC-001.4.23: attendance is restored as form text", () => {
    const values = draftFormValues({ id: 'draft-1', status: 'draft', updatedAt: '', values: {
      name: 'Dinner', expectedAttendance: 12, registrationRequired: true,
    } })
    expect(values).toMatchObject({ name: 'Dinner', expectedAttendance: '12', purpose: '', registrationRequired: true })
  })
})
