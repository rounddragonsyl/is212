import { describe, expect, test } from 'vitest'
import { CREDENTIAL_MESSAGES, validateCredentials } from '../validation'
import type { CredentialIssue } from '../validation'

/**
 * Authentication story. Rename to AC-0NN.x once the story number is confirmed in the
 * backlog — the traceability matrix expects the AC prefix.
 */
const messageFor = (issues: CredentialIssue[], field: CredentialIssue['field']) =>
  issues.find((issue) => issue.field === field)?.message

describe('credential validation', () => {
  test('accepts a well-formed email and password', () => {
    const result = validateCredentials({
      email: 'organiser@example.com',
      password: 'correct-horse',
    })

    expect(result.ok).toBe(true)
  })

  test('trims surrounding whitespace from the email', () => {
    // Copy-pasted addresses routinely carry a trailing space, and the sign-in would
    // otherwise fail with no visible reason.
    const result = validateCredentials({
      email: '  organiser@example.com  ',
      password: 'correct-horse',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.email).toBe('organiser@example.com')
  })

  test('rejects a missing email', () => {
    const result = validateCredentials({ password: 'correct-horse' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'email')).toBe(CREDENTIAL_MESSAGES.emailRequired)
  })

  test('rejects an email without an @', () => {
    const result = validateCredentials({ email: 'organiser.example.com', password: 'abcdef' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'email')).toBe(CREDENTIAL_MESSAGES.emailInvalid)
  })

  test('rejects a missing password', () => {
    const result = validateCredentials({ email: 'organiser@example.com' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'password')).toBe(CREDENTIAL_MESSAGES.passwordRequired)
  })

  test('rejects a 5 character password (boundary, invalid)', () => {
    const result = validateCredentials({ email: 'organiser@example.com', password: '12345' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(messageFor(result.issues, 'password')).toBe(CREDENTIAL_MESSAGES.passwordTooShort)
  })

  test('accepts a 6 character password (boundary, valid)', () => {
    // Supabase's own minimum. Rejecting six here would lock out an account the service
    // was willing to create.
    const result = validateCredentials({ email: 'organiser@example.com', password: '123456' })

    expect(result.ok).toBe(true)
  })

  test('reports both fields at once rather than one at a time', () => {
    const result = validateCredentials({})

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.field).sort()).toEqual(['email', 'password'])
  })
})
