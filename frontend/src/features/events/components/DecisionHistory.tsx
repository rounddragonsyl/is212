import { formatDateTime } from '../formatters'
import type { ReviewDecision, ReviewDecisionOutcome } from '../types'

const OUTCOME_LABELS: Record<ReviewDecisionOutcome, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned for more detail',
}

const OUTCOME_CLASSES: Record<ReviewDecisionOutcome, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  returned: 'bg-amber-50 text-amber-800 ring-amber-600/20',
}

/**
 * AC-004.5: every decision, its reason and who made it, newest first. The event row only
 * holds the latest decision; this is the retained trail behind it.
 *
 * Presentational only. The page loads the decisions through eventReviewService, so this
 * component never touches Supabase.
 */
export function DecisionHistory({ decisions }: { decisions: ReviewDecision[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-500">No decisions have been recorded for this request yet.</p>
  }

  return (
    <ol aria-label="Decision history" className="space-y-4">
      {decisions.map((decision) => (
        <li key={decision.id} className="border-l-2 border-slate-200 pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
                ${OUTCOME_CLASSES[decision.decision]}`}
            >
              {OUTCOME_LABELS[decision.decision]}
            </span>
            <span className="text-sm text-slate-700">by {decision.decidedByName}</span>
            <time dateTime={decision.decidedAt} className="text-xs text-slate-500">
              {formatDateTime(decision.decidedAt)}
            </time>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">
            {decision.reason ?? 'No reason was given.'}
          </p>
        </li>
      ))}
    </ol>
  )
}
