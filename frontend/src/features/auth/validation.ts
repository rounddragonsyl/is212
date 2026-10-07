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

export const SIGN_UP_MESSAGES = {
  nameRequired: 'Enter your name.',
} as const

export const MINIMUM_PASSWORD_LENGTH = 6

// Shared by sign-in and sign-up, so the two forms can never disagree about what a valid
// email or password is.
const emailField = z
  .string()
  .trim()
  .min(1, CREDENTIAL_MESSAGES.emailRequired)
  .email(CREDENTIAL_MESSAGES.emailInvalid)

const passwordField = z
  .string()
  .min(1, CREDENTIAL_MESSAGES.passwordRequired)
  .min(MINIMUM_PASSWORD_LENGTH, CREDENTIAL_MESSAGES.passwordTooShort)

const credentialSchema = z.object({ email: emailField, password: passwordField })

// profiles.full_name is NOT NULL and has no other rule, so a name only has to be non-blank
// once trimmed. No length or character rules are invented here (US29 assumption A5).
const signUpDetailsSchema = z.object({
  fullName: z.string().trim().min(1, SIGN_UP_MESSAGES.nameRequired),
  email: emailField,
  password: passwordField,
})

/** What the sign-up form submits: the details plus an optional request for organiser access. */
export const signUpFormSchema = signUpDetailsSchema.extend({ requestOrganiser: z.boolean() })
export type SignUpFormValues = z.infer<typeof signUpFormSchema>

interface FieldIssue<Field extends string> {
  field: Field
  message: string
}

export type CredentialIssue = FieldIssue<'email' | 'password'>
export type SignUpIssue = FieldIssue<'fullName' | 'email' | 'password'>

/** One message per field: an empty password trips both "required" and "too short". */
function firstIssuePerField<Field extends string>(error: z.ZodError): FieldIssue<Field>[] {
  const issues: FieldIssue<Field>[] = []
  const seen = new Set<string>()

  for (const issue of error.issues) {
    const field = issue.path[0] as Field
    if (seen.has(field)) continue
    seen.add(field)
    issues.push({ field, message: issue.message })
  }

  return issues
}

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

  return result.success
    ? { ok: true, email: result.data.email, password: result.data.password }
    : { ok: false, issues: firstIssuePerField(result.error) }
}

export type SignUpValidation =
  | { ok: true; fullName: string; email: string; password: string }
  | { ok: false; issues: SignUpIssue[] }

export function validateSignUp(input: {
  fullName?: string
  email?: string
  password?: string
}): SignUpValidation {
  const result = signUpDetailsSchema.safeParse({
    fullName: input.fullName ?? '',
    email: input.email ?? '',
    password: input.password ?? '',
  })

  return result.success
    ? { ok: true, ...result.data }
    : { ok: false, issues: firstIssuePerField(result.error) }
}
