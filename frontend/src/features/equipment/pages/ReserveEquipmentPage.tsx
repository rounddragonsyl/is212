import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { ReservationQueue } from '../components/ReservationQueue'

export function ReserveEquipmentPage() {
  const { profile, loading } = useCurrentUser()

  return <PageContainer>
    <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Reserve equipment</h1>
    <p className="mb-6 text-sm text-slate-600">
      Requirements pending review, with the units free for each event's window.
    </p>
    {loading ? <p className="text-sm text-slate-500">Loading…</p>
      : !profile ? <p className="text-sm text-slate-600">Sign in to reserve equipment.</p>
        : <ReservationQueue key={profile.id} viewer={{ id: profile.id, role: profile.role }} />}
  </PageContainer>
}
