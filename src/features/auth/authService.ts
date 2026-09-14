import { supabase } from '../../lib/supabase'
import { isUserRole } from './types'
import type { AppSession, AuthResult, UserProfile, UserRole } from './types'

/**
 * The only module that talks to Supabase about sessions and profiles.
 *
 * US-002 owns the real authentication story. This exists so US-005 can be exercised
 * end to end before then, and so the session plumbing the later story needs is already
 * in the right place rather than bolted onto a component.
 */

export const AUTH_MESSAGES = {
  signInFailed: 'That email and password combination was not recognised.',
  unknownRole: 'Your profile has a role this version of the app does not recognise.',
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

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({ email, password })
  return error ? { ok: false, reason: error.message } : { ok: true }
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

/**
 * DEVELOPMENT SCAFFOLDING — pairs with dev_set_my_role in 0003_roles.sql, which is dropped
 * before release. Normal role assignment is an administrator's job: the database trigger
 * prevent_role_self_assignment refuses a direct update from a signed-in user.
 */
export async function devSetMyRole(role: UserRole): Promise<AuthResult> {
  const { error } = await supabase.rpc('dev_set_my_role', { new_role: role })
  return error ? { ok: false, reason: error.message } : { ok: true }
}
