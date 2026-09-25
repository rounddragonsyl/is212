import { useCallback, useState } from 'react'
import { useRequestResource } from '../status/useRequestResource'
import { getMyChangeRequests, withdrawChangeRequest } from '../eventChangeRequestService'
import { ChangeRequestSummary } from './ChangeRequestSummary'

export function ChangeRequestList({ eventId, organiserId, currentUserId }: {
  eventId: string
  organiserId: string
  currentUserId?: string
}) {
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const read = useCallback(async () => ({
    ok: true as const, value: await getMyChangeRequests(eventId),
  }), [eventId])
  const { value: requests, loading, error, refresh } = useRequestResource(
    `change-requests:${eventId}:${currentUserId}`, read,
  )

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
    {withdrawError && <p role="alert" className="mb-3 text-sm text-red-700">{withdrawError}</p>}
    <ul className="space-y-4">
      {requests.map((request) => <li key={request.id} className="rounded-lg border border-slate-100 p-4">
        <ChangeRequestSummary request={request} />
        {currentUserId === organiserId && request.status === 'submitted' && <button type="button"
          disabled={withdrawing} onClick={() => { void handleWithdraw(request.id) }}
          className="mt-3 text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
          Withdraw request
        </button>}
      </li>)}
    </ul>
  </>
}
