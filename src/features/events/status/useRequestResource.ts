import { useCallback, useEffect, useRef, useState } from 'react'

export const STATUS_REFRESH_MS = 30_000
type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

/** Refresh on focus and periodically without allowing older responses to win. */
export function useRequestResource<T>(key: string, read: () => Promise<Result<T>>) {
  const [state, setState] = useState<{
    key: string; value: T | null; error: string | null; loading: boolean
  }>({ key, value: null, error: null, loading: true })
  const refreshRef = useRef<() => void>(() => {})
  const refresh = useCallback(() => refreshRef.current(), [])

  useEffect(() => {
    let active = true
    let pending = false
    let queued = false
    const load = async () => {
      if (!active) return
      if (pending) {
        queued = true
        return
      }
      pending = true
      try {
        const result = await read()
        if (active) setState({ key, loading: false,
          value: result.ok ? result.value : null,
          error: result.ok ? null : result.reason })
      } catch {
        if (active) setState({ key, value: null, loading: false,
          error: 'The event requests could not be loaded. Please try again.' })
      } finally {
        pending = false
        // A refresh after a review decision must not disappear behind an older read.
        if (active && queued) {
          queued = false
          void load()
        }
      }
    }
    refreshRef.current = () => { void load() }
    void load()
    const timer = window.setInterval(() => { void load() }, STATUS_REFRESH_MS)
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [key, read])

  return { ...(state.key === key ? state :
    { value: null, error: null, loading: true }), refresh }
}
