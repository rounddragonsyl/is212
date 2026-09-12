import { useState } from 'react'
import { devSetMyRole } from '../authService'
import { USER_ROLES, USER_ROLE_LABELS } from '../types'
import type { UserProfile, UserRole } from '../types'

interface DevRoleSwitcherProps {
  profile: UserProfile
  onChanged: () => void
}

/**
 * DEVELOPMENT SCAFFOLDING — rendered only under import.meta.env.DEV.
 *
 * Switches the signed-in user between roles so one test account can exercise stories
 * written for all five, instead of juggling five accounts during a demo. It calls the
 * dev_set_my_role function, which 0003_roles.sql documents as droppable before release.
 */
export function DevRoleSwitcher({ profile, onChanged }: DevRoleSwitcherProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = async (role: UserRole) => {
    if (role === profile.role) return
    setBusy(true)
    setError(null)

    const result = await devSetMyRole(role)
    if (!result.ok) setError(result.reason)
    else onChanged()

    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Dev · act as
        </span>
        <label htmlFor="dev-role" className="sr-only">
          Switch role
        </label>
        <select
          id="dev-role"
          value={profile.role}
          disabled={busy}
          onChange={(event) => void change(event.target.value as UserRole)}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs
            text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2
            focus:ring-amber-500/30 disabled:opacity-60"
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Testing only — real roles are assigned by an administrator.
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
