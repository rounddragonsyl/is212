import { describe, expect, test } from 'vitest'
import { REGISTRATION_MESSAGES, validateRegistration } from '../validation'
import type { RegistrationInput, RegistrationIssue, RegistrationValidation } from '../validation'

const noPrerequisites = { hasPrerequisites: false }
const withPrerequisites = { hasPrerequisites: true }
const valid: RegistrationInput = { phone: '91234567', prerequisitesConfirmed: false }

function messageFor(result: RegistrationValidation, field: RegistrationIssue['field']) {
  if (result.ok) throw new Error('expected the answers to be rejected')
  return result.issues.find((issue) => issue.field === field)?.message
}

describe('AC-015.2: the Attendee inputs the information required to register', () => {
  test('AC-015.2.1: accepts valid answers, trimming text and storing blanks as null', () => {
    const result = validateRegistration(
      { phone: ' +65 9123 4567 ', dietaryRequirements: '  ', accessibilityNeeds: 'Wheelchair' },
      noPrerequisites,
    )

    expect(result).toEqual({
      ok: true,
      answers: {
        phone: '+65 9123 4567',
        dietaryRequirements: null,
        accessibilityNeeds: 'Wheelchair',
        prerequisitesConfirmed: false,
      },
    })
  })

  test('AC-015.2.2: rejects a missing phone number', () => {
    const result = validateRegistration({ ...valid, phone: '' }, noPrerequisites)
    expect(messageFor(result, 'phone')).toBe(REGISTRATION_MESSAGES.phoneRequired)
  })

  test('AC-015.2.3: rejects a phone number with letters', () => {
    const result = validateRegistration({ ...valid, phone: '9123 ABCD' }, noPrerequisites)
    expect(messageFor(result, 'phone')).toBe(REGISTRATION_MESSAGES.phoneInvalid)
  })

  test('AC-015.2.4: rejects 7 digits and accepts 8 (boundary)', () => {
    expect(messageFor(validateRegistration({ ...valid, phone: '9123456' }, noPrerequisites), 'phone'))
      .toBe(REGISTRATION_MESSAGES.phoneInvalid)
    expect(validateRegistration({ ...valid, phone: '91234567' }, noPrerequisites).ok).toBe(true)
  })

  test('AC-015.2.5: accepts 15 digits and rejects 16 (boundary)', () => {
    expect(validateRegistration({ ...valid, phone: '+123456789012345' }, noPrerequisites).ok).toBe(true)
    expect(messageFor(validateRegistration({ ...valid, phone: '+1234567890123456' }, noPrerequisites), 'phone'))
      .toBe(REGISTRATION_MESSAGES.phoneInvalid)
  })

  test('AC-015.2.6: requires the prerequisites confirmation only when the event has prerequisites', () => {
    const unconfirmed = { ...valid, prerequisitesConfirmed: false }

    expect(messageFor(validateRegistration(unconfirmed, withPrerequisites), 'prerequisitesConfirmed'))
      .toBe(REGISTRATION_MESSAGES.prerequisitesRequired)
    expect(validateRegistration(unconfirmed, noPrerequisites).ok).toBe(true)
    expect(validateRegistration({ ...valid, prerequisitesConfirmed: true }, withPrerequisites).ok).toBe(true)
  })
})
