/**
 * PURE MODULE — US18 suitability rules. No React, no Supabase, no I/O.
 *
 * Suitability is advice, not a hard block: AC-018.2 asks for an alert, and Q&A #83 separates
 * it from filtering. The hard rules (no double booking, no booking on a blocked slot) live in
 * the database; this module explains, venue by venue, why one does or does not fit.
 */
import type {
  OccupiedCell, SuitabilityReason, TimingState, VenueAssessment, VenueLayoutCapacity, VenueProfile, VenueRequirements,
} from './suitabilityTypes'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, featureLabel } from './venueFeatureCatalogue'
import { SLOT_SHORT_LABELS, formatPlainDate } from './slotFormat'

export interface SuitabilityInput {
  venue: VenueProfile
  /** Read from the event, never stored twice (#119). */
  expectedAttendance: number | null
  requirements: VenueRequirements
  layoutLabel: (code: string) => string
  timing: TimingState
  /** Cells of this event's booking already held by another booking or a block. */
  occupied: OccupiedCell[]
}

function capacityReasons(input: SuitabilityInput): SuitabilityReason[] {
  const { venue, expectedAttendance: attendance, requirements, layoutLabel } = input

  if (requirements.layout) {
    const layout = venue.layouts.find((candidate) => candidate.layout === requirements.layout)
    if (!layout) {
      return [{ code: 'layout', message: `Does not support the ${layoutLabel(requirements.layout)} layout.` }]
    }
    // Capacity depends on the layout (#112), so only the required layout's capacity counts.
    if (attendance !== null && layout.capacity < attendance) {
      return [{
        code: 'capacity',
        message: `Holds ${layout.capacity} in the ${layoutLabel(layout.layout)} layout; ${attendance} attendees are expected.`,
      }]
    }
    return []
  }

  if (attendance === null || venue.layouts.length === 0) return []
  const largest = Math.max(...venue.layouts.map((layout) => layout.capacity))
  return largest < attendance
    ? [{ code: 'capacity', message: `Holds at most ${largest} in any layout; ${attendance} attendees are expected.` }]
    : []
}

function missingFeatureReasons(input: SuitabilityInput): SuitabilityReason[] {
  const { venue, requirements } = input
  const reasons: SuitabilityReason[] = []

  const missingAccess = requirements.accessibility.filter((code) => !venue.accessibility.includes(code))
  if (missingAccess.length > 0) {
    reasons.push({
      code: 'accessibility',
      message: `Missing accessibility: ${missingAccess.map((code) => featureLabel(ACCESSIBILITY_OPTIONS, code)).join(', ')}.`,
    })
  }

  // Values may be counts or booleans; present when truthy, the same rule US8 search uses.
  const missingFacilities = requirements.facilities.filter((code) => !venue.facility[code])
  if (missingFacilities.length > 0) {
    reasons.push({
      code: 'facility',
      message: `Missing facilities: ${missingFacilities.map((code) => featureLabel(FACILITY_OPTIONS, code)).join(', ')}.`,
    })
  }
  return reasons
}

function describeCell(cell: OccupiedCell): string {
  return `${formatPlainDate(cell.date)} (${SLOT_SHORT_LABELS[cell.slot]})`
}

function availabilityReasons(input: SuitabilityInput): SuitabilityReason[] {
  const { venue, occupied } = input
  const reasons: SuitabilityReason[] = []
  if (venue.status === 'under_maintenance') {
    reasons.push({ code: 'venue_status', message: 'The venue is under maintenance.' })
  }

  const blocked = occupied.filter((cell) => cell.kind === 'maintenance')
  if (blocked.length > 0) {
    reasons.push({ code: 'blocked', message: `Blocked by Venue Staff on ${blocked.map(describeCell).join(', ')}.` })
  }  
  // A buffer cell is another booking's setup or turnaround: still taken, so still booked.
  const booked = occupied.filter((cell) => cell.kind !== 'maintenance')
  if (booked.length > 0) {
    reasons.push({ code: 'booked', message: `Already booked on ${booked.map(describeCell).join(', ')}.` })
  }
  return reasons
}

export function fittingLayouts(venue: VenueProfile, attendance: number | null): VenueLayoutCapacity[] {
  return venue.layouts
    .filter((layout) => attendance === null || layout.capacity >= attendance)
    .sort((a, b) => a.capacity - b.capacity)
}

/** AC-018.1/.3/.4: one venue's verdict, with every reason rather than only the first. */
export function evaluateVenueSuitability(input: SuitabilityInput): VenueAssessment {
  const unavailable = availabilityReasons(input)
  const unsuitable = [...capacityReasons(input), ...missingFeatureReasons(input)]
  const verdict = unavailable.length > 0 ? 'unavailable' : unsuitable.length > 0 ? 'unsuitable' : 'suitable'
  return {
    venue: input.venue,
    verdict,
    reasons: [...unavailable, ...unsuitable],
    fittingLayouts: fittingLayouts(input.venue, input.expectedAttendance),
  }
}

const VERDICT_ORDER = { suitable: 0, unsuitable: 1, unavailable: 2 } as const

/** Suitable venues first, then unsuitable, then blacked out; alphabetical within each. */
export function sortAssessments(assessments: VenueAssessment[]): VenueAssessment[] {
  return [...assessments].sort((a, b) =>
    VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || a.venue.name.localeCompare(b.venue.name))
}

/** Drops blanks and repeats before saving, so the database's no-blank-code rule is never
 *  the first thing to notice. */
export function normaliseRequirements(input: VenueRequirements): VenueRequirements {
  const clean = (codes: string[]) => [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
  const layout = input.layout?.trim() ?? ''
  return { layout: layout === '' ? null : layout, accessibility: clean(input.accessibility), facilities: clean(input.facilities) }
}