import { z } from 'zod'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * Client-side credential checks exist to save a round trip and to say something specific,
 * not to secure anything. Supabase enforces the real rules; if these two ever disagree,
 * Supabase wins and its message is what the user sees.
 */

export const CREDENTIAL_MESSAGES = {
  emailRequired: 'Enter your email address.',
  emailInvalid: 'That does not look like an email address.',
  passwordRequired: 'Enter your password.',
  // Supabase's default minimum. Stated as a number rather than "too short" so the user
  // knows what to aim for on the first try.
  passwordTooShort: 'Your password must be at least 6 characters.',
} as const

export const MINIMUM_PASSWORD_LENGTH = 6

export interface CredentialIssue {
  field: 'email' | 'password'
  message: string
}

const credentialSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, CREDENTIAL_MESSAGES.emailRequired)
    .email(CREDENTIAL_MESSAGES.emailInvalid),
  password: z
    .string()
    .min(1, CREDENTIAL_MESSAGES.passwordRequired)
    .min(MINIMUM_PASSWORD_LENGTH, CREDENTIAL_MESSAGES.passwordTooShort),
})

export type CredentialResult =
  | { ok: true; email: string; password: string }
  | { ok: false; issues: CredentialIssue[] }

export function validateCredentials(input: {
  email?: string
  password?: string
}): CredentialResult {
  const result = credentialSchema.safeParse({
    email: input.email ?? '',
    password: input.password ?? '',
  })

  if (result.success) {
    return { ok: true, email: result.data.email, password: result.data.password }
  }

  const issues: CredentialIssue[] = []
  const seen = new Set<string>()

  for (const issue of result.error.issues) {
    // One message per field: an empty password trips both "required" and "too short".
    const field = issue.path[0] as CredentialIssue['field']
    if (seen.has(field)) continue
    seen.add(field)
    issues.push({ field, message: issue.message })
  }

  return { ok: false, issues }
}

// US29 sign-up. Stub until the implementation step: the tests are written first.
export const SIGN_UP_MESSAGES = {
  nameRequired: 'Enter your name.',
} as const

export interface SignUpIssue {
  field: 'fullName' | 'email' | 'password'
  message: string
}

export type SignUpValidation =
  | { ok: true; fullName: string; email: string; password: string }
  | { ok: false; issues: SignUpIssue[] }

export function validateSignUp(_input: {
  fullName?: string
  email?: string
  password?: string
}): SignUpValidation {
  throw new Error('Not implemented: US29 sign-up validation')
}
