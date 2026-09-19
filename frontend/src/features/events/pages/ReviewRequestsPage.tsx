import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestListItem } from '../components/RequestListItem'
import { listEventRequests } from '../eventReviewService'
import { useRequestResource } from '../status/useRequestResource'

/**
 * A coordinator's queue of incoming requests.
 *
 * No role filtering happens here. The query is identical whoever runs it, and RLS decides
 * what comes back — a coordinator sees every request, an organiser only their own. That is
 * the argument for enforcing authorisation in the database rather than the client.
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

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          {isManager ? 'Event operations manager' : isCoordinator ? 'Event coordinator' : 'Event requests'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {isCoordinator || isManager ? 'Incoming requests' : 'Your requests'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {isManager ? 'View submitted events and their current progress.' : isCoordinator
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
            <RequestListItem key={request.id} request={request} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
