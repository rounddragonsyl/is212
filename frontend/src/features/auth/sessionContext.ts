import { createContext, useContext } from 'react'
import type { AppSession, UserProfile } from './types'

export interface CurrentUser {
  session: AppSession | null
  profile: UserProfile | null
  loading: boolean
  refresh: () => Promise<void>
}

// Context and hook live apart from the provider component so the provider file exports
// only components, which is what keeps Fast Refresh working during development.
export const SessionContext = createContext<CurrentUser | null>(null)

export function useCurrentUser(): CurrentUser {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useCurrentUser must be used inside a SessionProvider')
  return value
}
