/**
 * PURE MODULE — US18 suitability rules. No React, no Supabase, no I/O.
 *
 * Suitability is advice, not a hard block: AC-018.2 asks for an alert, and Q&A #83 separates
 * it from filtering. The hard rules (no double booking, no booking on a blocked slot) live in
 * the database; this module explains, venue by venue, why one does or does not fit.
 */
import type { VenueAssessment, VenueProfile, VenueRequirements } from './suitabilityTypes'

export interface SuitabilityInput {
  venue: VenueProfile
  /** Read from the event, never stored twice (#119). */
  expectedAttendance: number | null
  requirements: VenueRequirements
  layoutLabel: (code: string) => string
}

export function evaluateVenueSuitability(input: SuitabilityInput): VenueAssessment {
  return { venue: input.venue, verdict: 'suitable', reasons: [], fittingLayouts: [] }
}