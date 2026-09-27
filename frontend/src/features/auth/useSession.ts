import { useEffect, useState } from 'react'
import { getCurrentSession, onSessionChange } from './authService'
import type { AppSession } from './types'

/**
 * Subscribes to the session so every consumer reacts to a sign-in or sign-out without
 * prop drilling. `loading` distinguishes "checking" from "signed out" — without it the
 * page flashes a sign-in prompt at a user who is already signed in.
 */
export function useSession() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getCurrentSession().then((current) => {
      if (!active) return
      setSession(current)
      setLoading(false)
    })

    const unsubscribe = onSessionChange((next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return { session, loading }
}
