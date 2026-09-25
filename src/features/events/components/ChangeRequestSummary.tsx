import { CHANGE_FIELD_LABELS, formatChangeValue } from '../changeRequestDisplay'
import { ChangeRequestStatusBadge } from './ChangeRequestStatusBadge'
import { formatDateTime } from '../formatters'
import type { EventChangeRequest, ProposedEventChanges } from '../types'

/** Shared read-only outcome: field questions/reasons must be visible to the organiser. */
export function ChangeRequestSummary({ request }: { request: EventChangeRequest }) {
  const unresolved = request.status === 'clarification_requested' || request.status === 'submitted'
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ChangeRequestStatusBadge status={request.status} />
      <span className="text-xs text-slate-500">Requested {formatDateTime(request.submittedAt)}</span>
    </div>
    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700"><strong>Organiser’s reason: </strong>{request.reason}</p>
    <ul className="mt-3 space-y-3 text-sm text-slate-700">
      {(Object.entries(request.proposedChanges) as [keyof ProposedEventChanges, unknown][]).map(([field, value]) => {
        const decision = request.fieldDecisions.find((item) => item.field === field)
        const label = decision?.decision === 'clarification_requested' ? 'Clarification required'
          : decision?.decision === 'approved' ? (unresolved ? 'Approved provisionally' : 'Approved')
            : (unresolved ? 'Rejected provisionally' : 'Rejected')
        return <li key={field} className="whitespace-pre-wrap">
          <strong>{CHANGE_FIELD_LABELS[field] ?? field}: </strong>{formatChangeValue(field, value)}
          {decision && <div className="mt-1 border-l-2 border-indigo-200 pl-3">
            <span className="font-medium">{label}</span>
            {decision.note && <p className="mt-1">{decision.note}</p>}
          </div>}
        </li>
      })}
    </ul>
    {request.reviewNote && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
      <strong>Coordinator’s note: </strong>{request.reviewNote}
    </p>}
    {request.status === 'clarification_requested' && <p className="mt-3 text-sm text-blue-800">
      This request is awaiting clarification. No proposed changes have been applied to the event.
    </p>}
  </>
}
