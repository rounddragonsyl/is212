import { supabase } from '../../lib/supabase'
import type { SuitabilityEvent, SuitabilityResult, VenueRequirements } from './suitabilityTypes'

export const SUITABILITY_MESSAGES = {
  notSignedIn: 'You must be signed in to check venue suitability.',
  eventNotFound: 'That event could not be found, or it is not assigned to you.',
  saveDenied: 'Only the coordinator assigned to this event can change its venue requirements.',
  unknownLayout: 'Choose a layout from the list.',
  saveFailed: 'The requirements could not be saved. Please try again.',
  // Failing closed: treating every venue as free when the check broke would mislead.
  availabilityFailed: 'Venue availability could not be checked. Please try again.',
  unexpected: 'Something went wrong checking venue suitability. Please try again.',
} as const

interface EventRow {
  id: string
  reference: string | null
  name: string | null
  proposed_start: string | null
  proposed_end: string | null
  expected_attendance: number | null
  layout_preference: string | null
  accessibility_requirements: string | null
}

interface RequirementsRow {
  layout: string | null
  accessibility: string[] | null
  facilities: string[] | null
}

function toEvent(row: EventRow): SuitabilityEvent {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    expectedAttendance: row.expected_attendance,
    layoutPreference: row.layout_preference,
    accessibilityRequirements: row.accessibility_requirements,
  }
}

function toRequirements(row: RequirementsRow | null): VenueRequirements {
  if (!row) return { layout: null, accessibility: [], facilities: [] }
  return { layout: row.layout, accessibility: row.accessibility ?? [], facilities: row.facilities ?? [] }
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data?.user?.id ?? null
}

/** The event and the coordinator's saved requirements. */
export async function loadEventSuitability(
  eventId: string,
): Promise<SuitabilityResult<{ event: SuitabilityEvent; requirements: VenueRequirements }>> {
  if (!(await currentUserId())) return { ok: false, reason: SUITABILITY_MESSAGES.notSignedIn }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, reference, name, proposed_start, proposed_end, expected_attendance, layout_preference, accessibility_requirements')
    .eq('id', eventId)
    .maybeSingle()
  // RLS hides events this coordinator may not see, so "not visible" looks the same as "missing".
  if (eventError || !event) return { ok: false, reason: SUITABILITY_MESSAGES.eventNotFound }

  const { data: requirements } = await supabase
    .from('event_venue_requirements')
    .select('layout, accessibility, facilities')
    .eq('event_id', eventId)
    .maybeSingle()

  return {
    ok: true,
    value: { event: toEvent(event as EventRow), requirements: toRequirements(requirements as RequirementsRow | null) },
  }
}