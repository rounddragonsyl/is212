import { CHANGE_FIELD_LABELS, CHANGE_STATUS_LABELS, formatChangeValue } from '../changeRequestDisplay'
import { formatDateTime } from '../formatters'
import type { ChangeRequestReviewHistoryEntry } from '../types'

export function ChangeRequestReviewHistory({ entries }: { entries: ChangeRequestReviewHistoryEntry[] }) {
  return <details className="mt-4 border-t border-slate-200 pt-3">
    <summary className="cursor-pointer text-sm font-semibold">Review decision history ({entries.length})</summary>
    {entries.length === 0 ? <p className="mt-2 text-sm text-slate-500">No review actions recorded since history tracking was enabled.</p>
      : <ol className="mt-3 space-y-3">{entries.map((entry) => <li key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-semibold">{CHANGE_STATUS_LABELS[entry.outcome]}</p>
        <p>{entry.reviewerName} · {formatDateTime(entry.reviewedAt)}</p>
        {entry.outcome === 'clarification_requested' && <p className="mt-2">Field decisions were provisional; event details remained unchanged.</p>}
        {entry.fieldDecisions.map((decision) => <div key={decision.field} className="mt-2 whitespace-pre-wrap">
          <p><strong>{CHANGE_FIELD_LABELS[decision.field]}: </strong>{formatChangeValue(decision.field, entry.proposedChanges[decision.field])}</p>
          <p>{CHANGE_STATUS_LABELS[decision.decision]}{decision.note && ` — ${decision.note}`}</p>
        </div>)}
        {entry.reviewNote && <p className="mt-2 whitespace-pre-wrap">{entry.reviewNote}</p>}
      </li>)}</ol>}
  </details>
}
