/**
 * PURE MODULE — US18 suitability rules. No React, no Supabase, no I/O.
 *
 * Suitability is advice, not a hard block: AC-018.2 asks for an alert, and Q&A #83 separates
 * it from filtering. The hard rules (no double booking, no booking on a blocked slot) live in
 * the database; this module explains, venue by venue, why one does or does not fit.
 */
import type { SuitabilityReason, VenueAssessment, VenueProfile, VenueRequirements } from './suitabilityTypes'

export interface SuitabilityInput {
  venue: VenueProfile
  /** Read from the event, never stored twice (#119). */
  expectedAttendance: number | null
  requirements: VenueRequirements
  layoutLabel: (code: string) => string
}

function capacityReasons(input: SuitabilityInput): SuitabilityReason[] {
  const { venue, expectedAttendance: attendance, requirements, layoutLabel } = input

  if (requirements.layout) {
    const layout = venue.layouts.find((candidate) => candidate.layout === requirements.layout)
    if (!layout) {
      return [{ code: 'layout', message: `Does not support the ${layoutLabel(requirements.layout)} layout.` }]
    }
    return []
  }

  if (attendance === null || venue.layouts.length === 0) return []
  const largest = Math.max(...venue.layouts.map((layout) => layout.capacity))
  return largest < attendance
    ? [{ code: 'capacity', message: `Holds at most ${largest} in any layout; ${attendance} attendees are expected.` }]
    : []
}

export function evaluateVenueSuitability(input: SuitabilityInput): VenueAssessment {
  const reasons = capacityReasons(input)
  return { venue: input.venue, verdict: reasons.length > 0 ? 'unsuitable' : 'suitable', reasons, fittingLayouts: [] }
}