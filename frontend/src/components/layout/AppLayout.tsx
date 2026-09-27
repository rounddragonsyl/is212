import { Outlet } from 'react-router-dom'
import { useCurrentUser } from '../../features/auth/sessionContext'
import { AppShell } from './AppShell'

/**
 * The layout route every page renders inside, so navigation and footer are declared once
 * rather than repeated per page.
 */
export function AppLayout() {
  const { session, profile, loading } = useCurrentUser()

  return (
    <AppShell session={session} profile={profile} loading={loading}>
      <Outlet />
    </AppShell>
  )
}
