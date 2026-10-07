// US15 registration service. Stub until the implementation step: the tests are written first.
import type { LoadResult, MyRegistration, OpenEvent, OpenEventDetails } from './types'
import type { RegistrationInput, RegistrationIssue } from './validation'

export const REGISTRATION_SERVICE_MESSAGES = {
  notOpen: 'This event is not open for registration.',
  registrationClosed: 'Registration is not open for this event.',
  duplicate: 'You are already registered for this event.',
  notAttendee: 'Only attendees can register for events.',
  checkFields: 'Check the highlighted fields.',
  failed: 'Your registration could not be saved. Please try again.',
  loadFailed: 'Events could not be loaded. Please try again.',
} as const

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: string; issues?: RegistrationIssue[] }

const notImplemented = (): never => {
  throw new Error('Not implemented: US15 registration service')
}

export async function loadOpenEvents(): Promise<LoadResult<OpenEvent[]>> {
  return notImplemented()
}

export async function loadOpenEvent(_eventId: string): Promise<LoadResult<OpenEventDetails>> {
  return notImplemented()
}

export async function registerForEvent(
  _eventId: string,
  _input: RegistrationInput,
  _options: { hasPrerequisites: boolean },
): Promise<RegisterResult> {
  return notImplemented()
}

export async function loadMyRegistrations(): Promise<LoadResult<MyRegistration[]>> {
  return notImplemented()
}
