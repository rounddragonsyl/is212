// US15 registration answers. Stub until the implementation step: the tests are written first.
import type { RegistrationAnswers } from './types'

export const REGISTRATION_MESSAGES = {
  phoneRequired: 'Enter a phone number.',
  phoneInvalid: 'Enter a phone number of 8 to 15 digits.',
  prerequisitesRequired: 'Confirm that you meet the prerequisites.',
} as const

export interface RegistrationIssue {
  field: keyof RegistrationAnswers
  message: string
}

export type RegistrationValidation =
  | { ok: true; answers: RegistrationAnswers }
  | { ok: false; issues: RegistrationIssue[] }

export interface RegistrationInput {
  phone?: string
  dietaryRequirements?: string
  accessibilityNeeds?: string
  prerequisitesConfirmed?: boolean
}

export function validateRegistration(
  _input: RegistrationInput,
  _options: { hasPrerequisites: boolean },
): RegistrationValidation {
  throw new Error('Not implemented: US15 registration validation')
}
