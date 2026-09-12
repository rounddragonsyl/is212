import { Outlet } from 'react-router-dom'
import { DevRoleSwitcher } from '../../features/auth/components/DevRoleSwitcher'
import { useCurrentUser } from '../../features/auth/sessionContext'
import { AppShell } from './AppShell'

/**
 * The layout route every page renders inside, so navigation, footer and the dev role
 * switcher are declared once rather than repeated per page.
 */
export function AppLayout() {
  const { session, profile, loading, refresh } = useCurrentUser()

  return (
    <AppShell session={session} profile={profile} loading={loading}>
      {import.meta.env.DEV && profile && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
          <DevRoleSwitcher profile={profile} onChanged={refresh} />
        </div>
      )}
      <Outlet />
    </AppShell>
  )
}
