import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { TechSupportEquipmentView } from '../components/TechSupportEquipmentView'

export function TechSupportEquipmentPage() {
  const { profile, loading } = useCurrentUser()

  return <PageContainer>
    <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Equipment</h1>
    {/* A courtesy check only: other roles would load nothing because RLS returns no rows. */}
    {loading ? <p className="text-sm text-slate-500">Loading…</p>
      : profile?.role !== 'tech_support'
        ? <p className="text-sm text-slate-600">This page is for Technical Support staff.</p>
        : <TechSupportEquipmentView />}
  </PageContainer>
}
