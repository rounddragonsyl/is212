import { expect, test } from 'vitest'
import { draftFormValues, toDateTimeInput } from '../draftFormValues'

test('Save Draft Event Request AC 4: restored dates preserve their instant and precision', () => {
  const timestamp = '2030-06-01T10:30:45.123Z'
  expect(new Date(toDateTimeInput(timestamp)).toISOString()).toBe(timestamp)
})

test('Save Draft Event Request AC 2/4: missing dates remain empty', () => {
  expect(toDateTimeInput()).toBe('')
  expect(toDateTimeInput('')).toBe('')
})

test('Save Draft Event Request AC 4: attendance is restored as form text', () => {
  const values = draftFormValues({ id: 'draft-1', status: 'draft', updatedAt: '', values: {
    name: 'Dinner', expectedAttendance: 12, registrationRequired: true,
  } })
  expect(values).toMatchObject({ name: 'Dinner', expectedAttendance: '12', purpose: '', registrationRequired: true })
})
