import { signOut } from '../authService'
import { USER_ROLE_LABELS } from '../types'
import type { AppSession, UserProfile } from '../types'

interface SessionBadgeProps {
  session: AppSession | null
  profile: UserProfile | null
  loading: boolean
}

/** Tells the truth about the session state, so a refused submission is never a mystery. */
export function SessionBadge({ session, profile, loading }: SessionBadgeProps) {
  if (loading) {
    return <span className="text-xs text-slate-400">Checking session…</span>
  }

  if (!session) {
    return (
      <span className="flex items-center gap-2 text-xs text-slate-500">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
        Not signed in
      </span>
    )
  }

  const initial = (session.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <span className="hidden flex-col items-end leading-tight sm:flex">
        <span className="flex items-center gap-2 text-xs text-slate-600">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
          {session.email ?? 'Signed in'}
        </span>
        {profile && (
          <span className="text-[11px] font-medium text-indigo-600">
            {USER_ROLE_LABELS[profile.role]}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900
          hover:underline"
      >
        Sign out
      </button>
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100
          text-xs font-semibold text-indigo-700"
      >
        {initial}
      </span>
    </div>
  )
}
