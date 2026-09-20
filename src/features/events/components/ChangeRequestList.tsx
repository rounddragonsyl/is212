import { useCallback } from 'react'
import { useRequestResource } from '../status/useRequestResource'
import { getMyChangeRequests, withdrawChangeRequest } from '../eventChangeRequestService'
import type { EventChangeRequest, ProposedEventChanges } from '../types'

const FIELD_LABELS: Record<keyof ProposedEventChanges, string> = {
  name: 'Event name',
  purpose: 'Purpose',
  eventType: 'Type of event',
  description: 'Description',
  proposedStart: 'Preferred start',
  proposedEnd: 'Preferred end',
  expectedAttendance: 'Expected attendance',
  programme: 'Programme',
  layoutPreference: 'Room layout',
  accessibilityRequirements: 'Accessibility',
  equipmentRequirements: 'Equipment',
  registrationRequired: 'Registration required',
  specialArrangements: 'Special arrangements',
}

function StatusPill({ status }: { status: EventChangeRequest['status'] }) {
  const styles: Record<EventChangeRequest['status'], string> = {
    submitted: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    partially_approved: 'bg-amber-50 text-amber-700',
    rejected: 'bg-red-50 text-red-700',
    clarification_requested: 'bg-blue-50 text-blue-700',
    withdrawn: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

function ProposedChangesList({ changes }: { changes: ProposedEventChanges }) {
  const entries = Object.entries(changes) as [keyof ProposedEventChanges, unknown][]
  return (
    <ul className="mt-2 space-y-1 text-sm text-slate-700">
      {entries.map(([field, value]) => (
        <li key={field}>
          <span className="text-slate-500">{FIELD_LABELS[field] ?? field}:</span>{' '}
          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
        </li>
      ))}
    </ul>
  )
}

export function ChangeRequestList({
  eventId,
  organiserId,
  currentUserId,
}: {
  eventId: string
  organiserId: string
  currentUserId?: string
}) {
  const read = useCallback(async () => {
    const requests = await getMyChangeRequests(eventId)
    return { ok: true as const, value: requests }
  }, [eventId])

  const { value: requests, loading, refresh } = useRequestResource(`change-requests:${eventId}`, read)

  const handleWithdraw = async (requestId: string) => {
    const outcome = await withdrawChangeRequest(requestId)
    if (outcome.ok) refresh()
    // A failed withdraw (e.g. already reviewed) is surfaced by simply not disappearing;
    // consider a toast/inline message here if silent failure is confusing in practice.
  }

  if (loading) return <p className="text-sm text-slate-500">Loading change requests…</p>
  if (!requests || requests.length === 0) {
    return <p className="text-sm text-slate-500">No changes have been requested for this event.</p>
  }

  const canWithdraw = currentUserId === organiserId

  return (
    <ul className="space-y-4">
      {requests.map((request) => (
        <li key={request.id} className="rounded-lg border border-slate-100 p-4">
          <div className="flex items-center justify-between gap-4">
            <StatusPill status={request.status} />
            <span className="text-xs text-slate-500">
              Requested {new Date(request.submittedAt).toLocaleString('en-SG', {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700">
            <span className="text-slate-500">Reason: </span>{request.reason}
          </p>

          <ProposedChangesList changes={request.proposedChanges} />

          {request.reviewNote && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="text-slate-500">Coordinator's note: </span>{request.reviewNote}
            </p>
          )}

          {canWithdraw && request.status === 'submitted' && (
            <button
              type="button"
              onClick={() => handleWithdraw(request.id)}
              className="mt-3 text-sm font-medium text-red-600 hover:underline"
            >
              Withdraw request
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
