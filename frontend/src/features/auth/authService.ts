import { supabase } from '../../lib/supabase'
import { SIGN_UP_LANDING_PATH, isUserRole } from './types'
import type { AppSession, AuthResult, SignUpInput, SignUpResult, UserProfile } from './types'

/**
 * The only module that talks to Supabase about sessions and profiles: sign-in, sign-up (US29),
 * sign-out and the caller's own profile. Pages call these functions and never import the
 * Supabase client, so every auth request goes through one place.
 */

export const AUTH_MESSAGES = {
  signInFailed: 'That email and password combination was not recognised.',
  unknownRole: 'Your profile has a role this version of the app does not recognise.',
  duplicateEmail: 'An account with this email already exists. Sign in instead.',
  signUpFailed: 'Your account could not be created. Please try again.',
} as const

export async function getCurrentSession(): Promise<AppSession | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  return user ? { userId: user.id, email: user.email ?? null } : null
}

/** Returns an unsubscribe function, so a React effect can clean up after itself. */
export function onSessionChange(listener: (session: AppSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user
    listener(user ? { userId: user.id, email: user.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  // Supabase deliberately returns the same error for a wrong password and an unknown
  // account, so that a stranger cannot use the form to discover who has registered.
  return error ? { ok: false, reason: error.message || AUTH_MESSAGES.signInFailed } : { ok: true }
}

const DUPLICATE_EMAIL: SignUpResult = {
  ok: false,
  reason: AUTH_MESSAGES.duplicateEmail,
  duplicate: true,
}

/**
 * US29: creates an Attendee account. The browser sends a display name and, if asked, a request
 * for organiser access — never a role. The database decides the role (0042), so a request
 * edited in dev tools still produces an Attendee.
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: input.requestOrganiser
        ? { full_name: input.fullName, requested_role: 'organiser' }
        : { full_name: input.fullName },
      // Supabase only follows this if it is listed under Authentication → URL Configuration →
      // Redirect URLs; otherwise the confirmation link goes to the Site URL.
      emailRedirectTo: `${window.location.origin}${SIGN_UP_LANDING_PATH}`,
    },
  })

  if (error) {
    return error.code === 'user_already_exists'
      ? DUPLICATE_EMAIL
      : { ok: false, reason: error.message || AUTH_MESSAGES.signUpFailed }
  }

  // With "Confirm email" on, Supabase does not say an email is taken: it returns a stand-in
  // user with no identities, so strangers cannot use the form to find out who has an account.
  // The team chose to tell the person instead (US29 assumption A3); no account is created.
  if (data.user && data.user.identities?.length === 0) return DUPLICATE_EMAIL

  // No session means the account waits for its confirmation link.
  return { ok: true, signedIn: Boolean(data.session) }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * The caller's own profile, including the role every later story branches on. Returns null
 * rather than throwing when there is no profile yet — that is a normal state between
 * signing in and the profile row being created.
 */
export async function getMyProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  // A role the app does not know about is a data problem, not a crash. Falling back would
  // silently grant organiser access, so we surface it as "no usable profile" instead.
  if (!isUserRole(data.role)) return null

  return { id: data.id, fullName: data.full_name, role: data.role }
}
