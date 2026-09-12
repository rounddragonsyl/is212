export const USER_ROLES = [
  'organiser',
  'coordinator',
  'venue_staff',
  'tech_support',
  'attendee',
] as const

export type UserRole = (typeof USER_ROLES)[number]

// Stored lowercase to match profiles_role_valid exactly; wording is presentation.
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  organiser: 'Event Organiser',
  coordinator: 'Event Coordinator',
  venue_staff: 'Venue Staff',
  tech_support: 'Technical Support',
  attendee: 'Attendee',
}

/** Narrows an arbitrary database string to a role we know how to render. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/** The slice of the Supabase session the app actually needs. */
export interface AppSession {
  userId: string
  email: string | null
}

export interface UserProfile {
  id: string
  fullName: string
  role: UserRole
}

export type AuthResult = { ok: true } | { ok: false; reason: string }
