import { useEffect, useState } from 'react'
import type { EventChangeRequest } from '../types'
import { ChangeRequestReplyForm } from './ChangeRequestReplyForm'
import { getMyChangeRequests, withdrawChangeRequest } from '../eventChangeRequestService'
import { ChangeRequestSummary } from './ChangeRequestSummary'

export function ChangeRequestList({ eventId, organiserId, currentUserId }: {
  eventId: string
  organiserId: string
  currentUserId?: string
}) {
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [requests, setRequests] = useState<EventChangeRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision((value) => value + 1)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setRequests(null)
    void getMyChangeRequests(eventId).then((value) => {
      if (active) { setRequests(value); setLoading(false) }
    }).catch(() => {
      if (active) { setError('The change requests could not be loaded. Please try again.'); setLoading(false) }
    })
    return () => { active = false }
  }, [eventId, currentUserId, revision])
  // No polling while answering: keep the questions and version the organiser saw.

  const handleWithdraw = async (requestId: string) => {
    if (withdrawing) return
    setWithdrawing(true)
    setWithdrawError(null)
    try {
      const outcome = await withdrawChangeRequest(requestId)
      if (outcome.ok) refresh()
      else setWithdrawError(outcome.reason)
    } catch {
      setWithdrawError('The request could not be withdrawn. Reload to check its status before trying again.')
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading change requests…</p>
  if (error) return <div>
    <p role="alert" className="text-sm text-red-700">{error}</p>
    <button type="button" onClick={refresh} className="mt-2 text-sm text-indigo-700">Retry loading change requests</button>
  </div>
  if (!requests || requests.length === 0) return <p className="text-sm text-slate-500">No changes have been requested for this event.</p>

  return <>
    <button type="button" disabled={withdrawing} onClick={() => { setNotice(null); refresh() }}
      className="mb-2 text-sm font-medium text-indigo-700">Reload change requests</button>
    <p className="mb-3 text-xs text-slate-500">Reloading clears unsaved answers.</p>
    {notice && <p role="status" className="mb-3 text-sm text-emerald-800">{notice}</p>}
    {withdrawError && <p role="alert" className="mb-3 text-sm text-red-700">{withdrawError}</p>}
    <ul className="space-y-4">
      {requests.map((request) => <li key={request.id} className="rounded-lg border border-slate-100 p-4">
        <ChangeRequestSummary request={request} />
        {currentUserId === organiserId && request.status === 'clarification_requested' && <ChangeRequestReplyForm
          key={`${revision}:${request.id}`} request={request} onSaved={() => {
            setNotice('Replies sent for review. Event details remain unchanged.')
            refresh()
          }} />}
        {currentUserId === organiserId && request.status === 'submitted' && <button type="button"
          disabled={withdrawing} onClick={() => { void handleWithdraw(request.id) }}
          className="mt-3 text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
          Withdraw request
        </button>}
      </li>)}
    </ul>
  </>
}
