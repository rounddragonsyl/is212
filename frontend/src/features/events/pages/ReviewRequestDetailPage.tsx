import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestDetails } from '../components/RequestDetails'
import { ReviewActions } from '../components/ReviewActions'
import { RequestStatusPanel } from '../status/RequestStatusPanel'
import { useRequestResource } from '../status/useRequestResource'
import { getEventRequest } from '../eventReviewService'
import { orDash } from '../formatters'

export function ReviewRequestDetailPage() {
  const { id = '' } = useParams()
  const { profile, loading: userLoading } = useCurrentUser()
  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: null }
    const result = await getEventRequest(id)
    return result.ok ? { ok: true as const, value: result.request } : result
  }, [id, userLoading])
  const { value: request, error, loading, refresh } = useRequestResource(
    `${id}:${profile?.id}:${profile?.role}:${userLoading}`, read,
  )

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

      <button type="button" onClick={refresh} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh status</button>
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

          {profile?.role === 'coordinator' && (
            <Card
              title="Decision"
              description="Your note is shared with the organiser."
            >
              <ReviewActions
                eventId={request.id}
                status={request.status}
                onReviewed={refresh}
              />
            </Card>
          )}
        </div>
      )}
      </div>
    </PageContainer>
  )
}
