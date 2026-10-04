import type { VenueAssessment } from '../suitabilityTypes'

const LABELS = {
  suitable: 'Suitable for this event',
  unsuitable: 'Unsuitable for this event',
  unavailable: 'Unavailable for this event',
} as const

const STYLES = {
  suitable: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  unsuitable: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  unavailable: 'bg-slate-100 text-slate-600 ring-slate-500/20',
} as const

/** A venue's verdict for one event, with its first reason. The full list lives on the
 *  suitability page; a search result only needs enough to decide whether to look closer. */
export function SuitabilityBadge({ assessment }: { assessment: VenueAssessment }) {
  const [first, ...rest] = assessment.reasons
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[assessment.verdict]}`}
      >
        {LABELS[assessment.verdict]}
      </span>
      {first && (
        <span className="text-xs text-slate-600">
          {rest.length > 0 ? `${first.message} (+${rest.length} more)` : first.message}
        </span>
      )}
    </div>
  )
}