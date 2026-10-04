import type { VenueAssessment } from '../suitabilityTypes'

interface SuitabilityResultListProps {
  assessments: VenueAssessment[]
  layoutLabel: (code: string) => string
}

const GROUPS = [
  { verdict: 'suitable', title: 'Suitable', description: "Meet every requirement and are free at the event's times." },
  { verdict: 'unsuitable', title: 'Unsuitable', description: 'Free, but do not meet every requirement.' },
  { verdict: 'unavailable', title: 'Unavailable', description: "Booked, blocked or closed at the event's times." },
] as const

/**
 * AC-018.1/.3/.4. Every assessed venue in one of three groups. Unavailable venues stay
 * visible but greyed out (blacked out), so the coordinator sees why a familiar room is missing.
 */
export function SuitabilityResultList({ assessments, layoutLabel }: SuitabilityResultListProps) {
  if (assessments.length === 0) {
    return <p className="text-sm text-slate-500">No venues to show.</p>
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        const items = assessments.filter((item) => item.verdict === group.verdict)
        if (items.length === 0) return null
        const headingId = `suitability-${group.verdict}`
        return (
          <section key={group.verdict} aria-labelledby={headingId}>
            <h3 id={headingId} className="text-sm font-semibold text-slate-900">
              {group.title} ({items.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
            <ul className="mt-3 space-y-2">
              {items.map((item) => {
                const blackedOut = item.verdict === 'unavailable'
                const nameId = `suitability-venue-${item.venue.id}`
                return (
                  <li
                    key={item.venue.id}
                    aria-labelledby={nameId}
                    aria-disabled={blackedOut ? 'true' : undefined}
                    className={
                      blackedOut
                        ? 'rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500'
                        : 'rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900'
                    }
                  >
                    <p className="text-sm font-medium">
                      <span id={nameId}>{item.venue.name}</span>
                      {item.venue.location && (
                        <span className="font-normal text-slate-500"> · {item.venue.location}</span>
                      )}
                    </p>
                    {item.verdict === 'suitable' && item.fittingLayouts.length > 0 && (
                      <p className="mt-1 text-xs text-slate-600">
                        Fits in: {item.fittingLayouts
                          .map((layout) => `${layoutLabel(layout.layout)} (${layout.capacity})`)
                          .join(', ')}
                      </p>
                    )}
                    {item.reasons.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {item.reasons.map((reason) => (
                          <li key={reason.message}>{reason.message}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}