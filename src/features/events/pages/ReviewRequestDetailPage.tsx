import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestDetails } from '../components/RequestDetails'
import { ReviewActions } from '../components/ReviewActions'
import { DecisionHistory } from '../components/DecisionHistory'
import { RequestStatusPanel } from '../status/RequestStatusPanel'
import { useRequestResource } from '../status/useRequestResource'
import { getEventRequest, listReviewDecisions } from '../eventReviewService'
import { orDash } from '../formatters'
import { LOCKED_STATUSES } from '../eventChangeRequestService'
import { ChangeRequestList } from '../components/ChangeRequestList'
import type { ReviewDecision } from '../types'

export function ReviewRequestDetailPage() {
  const { id = '' } = useParams()
  const { profile, loading: userLoading } = useCurrentUser()

  // The decision log is internal (it names the reviewer), so only staff load it. RLS
  // enforces the same rule; skipping the query here just avoids a pointless round trip.
  const canSeeHistory = profile?.role === 'coordinator' || profile?.role === 'operations_manager'

  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: null }
    const result = await getEventRequest(id)
    return result.ok ? { ok: true as const, value: result.request } : result
  }, [id, userLoading])
  const { value: request, error, loading, refresh } = useRequestResource(
    `${id}:${profile?.id}:${profile?.role}:${userLoading}`, read,
  )

  const readHistory = useCallback(async () => {
    if (userLoading || !canSeeHistory) return { ok: true as const, value: [] as ReviewDecision[] }
    const result = await listReviewDecisions(id)
    return result.ok ? { ok: true as const, value: result.decisions } : result
  }, [id, userLoading, canSeeHistory])
  const history = useRequestResource(
    `history:${id}:${profile?.id}:${profile?.role}:${userLoading}`, readHistory,
  )

  // A decision changes both the status and the trail, so both reload together.
  const refreshAll = useCallback(() => {
    refresh()
    history.refresh()
  }, [refresh, history.refresh])

  return (
    <PageContainer>
      <div className="max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
          <Link to="/requests" className="hover:text-slate-900 hover:underline">
            Requests
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span className="text-slate-700">{request ? orDash(request.reference) : 'Request'}</span>
        </nav>

        <button type="button" onClick={refreshAll} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh status</button>
        {loading || userLoading ? (
          <p className="text-sm text-slate-500">Loading request…</p>
        ) : error || !request ? (
          <Card title="Request unavailable">
            <p className="text-sm text-slate-600">{error}</p>
            <Link
              to="/requests"
              className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline"
            >
              Back to all requests
            </Link>
          </Card>
        ) : (
          <div className="space-y-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-slate-500">{orDash(request.reference)}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {orDash(request.name ?? request.purpose)}
                </h1>
              </div>
            </header>

            <RequestStatusPanel request={request} />
            <p className="text-xs text-slate-500">Status updates automatically every 30 seconds.</p>

            <Card title="Request details">
              <RequestDetails request={request} />
            </Card>

            <Card title="Requested changes" description="Changes proposed by the organiser for this event.">
              <ChangeRequestList
                eventId={request.id}
                organiserId={request.organiserId}
                currentUserId={profile?.id}
              />
            </Card>

            {profile?.role === 'coordinator' && (
              <Card
                title="Decision"
                description="Your note is shared with the organiser, who is emailed when you approve or reject."
              >
                <ReviewActions
                  eventId={request.id}
                  status={request.status}
                  onReviewed={refreshAll}
                />
              </Card>
            )}

            {canSeeHistory && (
              <Card
                title="Decision history"
                description="Every review decision on this request, with its reason and reviewer. Internal to staff."
              >
                {history.loading ? (
                  <p className="text-sm text-slate-500">Loading decision history…</p>
                ) : history.error ? (
                  <p role="alert" className="text-sm text-red-700">{history.error}</p>
                ) : (
                  <DecisionHistory decisions={history.value ?? []} />
                )}
              </Card>
            )}

            {profile?.role === 'organiser' && !LOCKED_STATUSES.includes(request.status) && (
              <Link
                to={`/requests/${request.id}/request-change`}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2
                  text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Request changes
              </Link>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
