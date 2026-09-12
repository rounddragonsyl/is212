import { useCallback, useEffect, useState } from 'react'
import { getMyProfile } from './authService'
import type { AppSession, UserProfile } from './types'

/**
 * The caller's profile, refetched whenever the session changes. Exposed as a hook so a
 * component asks "what am I?" once, instead of every consumer querying the table.
 *
 * `refresh` exists for the dev role switcher: the role changes in the database without any
 * session event to react to, so the caller tells us to look again.
 */
export function useProfile(session: AppSession | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = session?.userId ?? null

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setProfile(await getMyProfile(userId))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return { profile, loading, refresh: load }
}
