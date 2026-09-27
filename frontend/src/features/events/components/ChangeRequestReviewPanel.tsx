import { ChangeRequestReviewHistory } from './ChangeRequestReviewHistory'
import { useEffect, useState } from 'react'
import { getChangeRequestReviewContext, CHANGE_REVIEW_LOAD_MESSAGES } from '../changeRequestReviewQueryService'
import { CHANGE_STATUS_LABELS } from '../changeRequestDisplay'
import { ChangeRequestSummary } from './ChangeRequestSummary'
import { ChangeRequestReviewForm } from './ChangeRequestReviewForm'
import type { ChangeRequestReviewContext } from '../types'

export function ChangeRequestReviewPanel({ eventId, onReviewed }: {
  eventId: string
  onReviewed: () => void
}) {
  const [context, setContext] = useState<ChangeRequestReviewContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setContext(null)
    setError(null)
    void getChangeRequestReviewContext(eventId).then((result) => {
      if (!active) return
      if (result.ok) setContext(result.context)
      else setError(result.reason)
      setLoading(false)
    }).catch(() => {
      if (active) { setError(CHANGE_REVIEW_LOAD_MESSAGES.failed); setLoading(false) }
    })
    return () => { active = false }
  }, [eventId, revision])

  // Deliberately no polling while choosing decisions. The exact displayed snapshot
  // is used for saving; the RPC refuses it if the event changes in the meantime.
  const canReview = context && ['submitted', 'under_review', 'approved', 'planning', 'confirmed'].includes(context.eventStatus)
  return <div className="space-y-4">
    <button type="button" disabled={loading} onClick={() => { setNotice(null); setRevision((value) => value + 1) }}
      className="text-sm font-medium text-indigo-700 hover:underline disabled:opacity-50">Reload review</button>
    <p className="text-xs text-slate-500">Reloading replaces the comparison and clears unsaved decisions.</p>
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">Loading change-request review…</p>
      : error ? <p role="alert" className="text-sm text-red-700">{error}</p>
        : context && <>
          {!canReview && <p className="text-sm text-slate-600">This event is not open for change-request review.</p>}
          {context.requests.length === 0 ? <p>No changes have been requested for this event.</p>
            : <ul className="space-y-5">{context.requests.map((request) => <li key={request.id}
              className="rounded-xl border border-slate-200 p-4 sm:p-5">
              <ChangeRequestSummary request={request} />
              <ChangeRequestReviewHistory entries={request.reviewHistory ?? []} />
              {canReview && request.status === 'submitted' && <ChangeRequestReviewForm
                key={`${revision}:${request.id}`} request={request} context={context}
                onSaved={(status) => {
                  setNotice(`Review saved: ${CHANGE_STATUS_LABELS[status]}.`)
                  setRevision((value) => value + 1)
                  onReviewed()
                }} />}
            </li>)}</ul>}
        </>}
  </div>
}
