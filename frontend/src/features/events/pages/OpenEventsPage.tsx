import { Navigate } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { useCurrentUser } from '../../auth/sessionContext'

/**
 * Where a new Attendee lands after sign-up (US29, AC-029.4). A placeholder by agreement: the
 * real list and registering belong to US15/US52, and they need their own read access for
 * Attendees. Showing event rows here would mean granting that access early, untested.
 */
export function OpenEventsPage() {
  const { session, loading } = useCurrentUser()

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Loading…</p>
      </PageContainer>
    )
  }

  // `from` brings them back here after signing in rather than to the home page.
  if (!session) return <Navigate to="/signin" replace state={{ from: '/events/open' }} />

  return (
    <PageContainer>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Events open for registration
      </h1>
      <div className="mt-6">
        <Card title="Nothing to register for yet">
          <p className="text-sm text-slate-600">
            Events you can register for will appear here.
          </p>
        </Card>
      </div>
    </PageContainer>
  )
}
