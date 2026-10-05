import { Button } from '../../../components/ui/Button'
import type { VenueAssessment } from '../suitabilityTypes'

interface UnsuitableVenueAlertProps {
  assessment: VenueAssessment
  /** Book the venue despite the warning. Never offered for an unavailable venue. */
  onProceed: () => void
  /** Go back and choose a different venue. */
  onCancel: () => void
}

const secondaryClasses =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 ' +
  'text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

/**
 * AC-018.2. Suitability is advice, so an unsuitable venue can still be booked once the
 * coordinator has seen why it does not fit. An unavailable venue cannot: the database
 * would refuse the booking, so offering "Book anyway" would only lead to an error.
 */
export function UnsuitableVenueAlert({ assessment, onProceed, onCancel }: UnsuitableVenueAlertProps) {
  if (assessment.verdict === 'suitable') return null

  const unavailable = assessment.verdict === 'unavailable'
  const titleId = `unsuitable-venue-${assessment.venue.id}`

  return (
    <div role="alertdialog" aria-labelledby={titleId} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p id={titleId} className="text-sm font-semibold text-amber-900">
        {assessment.venue.name} is {unavailable ? 'not available' : 'not suitable'} for this event
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
        {assessment.reasons.map((reason) => (
          <li key={reason.message}>{reason.message}</li>
        ))}
      </ul>
      {unavailable && (
        <p className="mt-2 text-xs text-amber-800">It cannot be booked for these times.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={onCancel}>Choose another venue</Button>
        {!unavailable && (
          <button type="button" onClick={onProceed} className={secondaryClasses}>Book anyway</button>
        )}
      </div>
    </div>
  )
}