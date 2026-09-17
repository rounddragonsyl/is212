import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../../auth/sessionContext'

/** Do not mount draft loaders until auth is ready. Database policies still enforce access. */
export function DraftAccess({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useCurrentUser()
  const location = useLocation()
  if (loading) return <p role="status">Checking your session…</p>
  if (!session) return (
    <p>Sign in to view your drafts. <Link className="text-indigo-700 underline" to="/signin"
      state={{ from: location.pathname }}>Sign in</Link></p>
  )
  if (profile?.role !== 'organiser') return <p>Drafts are available to event organisers only.</p>
  // Changing accounts must discard the previous account's loaded data and form state.
  return <div key={session.userId}>{children}</div>
}
