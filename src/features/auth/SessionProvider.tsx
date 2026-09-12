import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { SessionContext } from './sessionContext'
import type { CurrentUser } from './sessionContext'
import { useProfile } from './useProfile'
import { useSession } from './useSession'

/**
 * One subscription to the session for the whole app. Without this, every page and the
 * header would each call useSession, opening several listeners that can briefly disagree
 * about who is signed in.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession()
  const { profile, loading: profileLoading, refresh } = useProfile(session)

  const value = useMemo<CurrentUser>(
    () => ({
      session,
      profile,
      // Still loading while a signed-in user's profile is on its way, so pages never
      // decide what to show from a half-known identity.
      loading: sessionLoading || (Boolean(session) && profileLoading),
      refresh,
    }),
    [session, profile, sessionLoading, profileLoading, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
