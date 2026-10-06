import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestListItem } from '../components/RequestListItem'
import { CoordinatorAssignmentQueue } from '../components/CoordinatorAssignmentQueue'
import { listEventRequests } from '../eventReviewService'
import { useRequestResource } from '../status/useRequestResource'

/**
 * Role-specific request views. RLS controls readable rows; the Lead's queue further
 * filters those rows to submitted requests still needing an assignment.
 */
export function ReviewRequestsPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: [] }
    const result = await listEventRequests(profile?.role === 'organiser')
    return result.ok ? { ok: true as const, value: result.requests } : result
  }, [profile?.role, userLoading])
  const { value, error, loading, refresh } = useRequestResource(
    `${profile?.id}:${profile?.role}:${userLoading}`, read,
  )
  const requests = value ?? []

  const isCoordinator = profile?.role === 'coordinator'
  const isManager = profile?.role === 'operations_manager'
  const isLead = profile?.role === 'coordinator_lead'

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          {isLead ? 'Coordinator Lead' : isManager ? 'Event operations manager' : isCoordinator ? 'Event coordinator' : 'Event requests'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {isLead ? 'Coordinator assignments' : isCoordinator || isManager ? 'Incoming requests' : 'Your requests'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {isLead ? 'Review the details of submitted requests waiting for a coordinator.' : isManager ? 'View submitted events and their current progress.' : isCoordinator
            ? 'Every submitted request, newest first. Open one to see the full details and decide.'
            : 'Your event requests, including drafts. Status updates automatically every 30 seconds.'}
        </p>
      </div>

      <button type="button" onClick={refresh} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh requests</button>

      {userLoading || loading ? (
        <p className="text-sm text-slate-500">Loading requests…</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </div>
      ) : isLead ? (
        <CoordinatorAssignmentQueue requests={requests} />
      ) : requests.length === 0 ? (
        <Card title="Nothing here yet">
          <p className="text-sm text-slate-600">
            {isCoordinator || isManager
              ? 'No requests have been submitted yet. They appear here the moment an organiser submits one.'
              : 'You have not created any event requests yet.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => (
            <RequestListItem key={request.id} request={request} organiserView={profile?.role === 'organiser'} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
