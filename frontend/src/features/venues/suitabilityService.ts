import { supabase } from '../../lib/supabase'
import { claimsForEvent } from './slots'
import type { SlotCell, TimeSlot } from './slots'
import { evaluateVenueSuitability, normaliseRequirements, sortAssessments } from './suitabilityValidation'
import type {
  LayoutType, SuitabilityEvent, SuitabilityResult, TimingState, VenueAssessment, VenueProfile, VenueRequirements,
} from './suitabilityTypes'
import type { VenueStatus } from './types'

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

/** The event and the coordinator's saved requirements (empty until first saved). */
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

  const { data: requirements, error: requirementsError } = await supabase
    .from('event_venue_requirements')
    .select('layout, accessibility, facilities')
    .eq('event_id', eventId)
    .maybeSingle()
  if (requirementsError) {
    console.error('[venues] loadEventSuitability', requirementsError)
    return { ok: false, reason: SUITABILITY_MESSAGES.unexpected }
  }

  return {
    ok: true,
    value: { event: toEvent(event as EventRow), requirements: toRequirements(requirements as RequirementsRow | null) },
  }
}


/** Upsert, so the first save and every later save are one call. The editor is the caller. */
export async function saveVenueRequirements(
  eventId: string,
  input: VenueRequirements,
): Promise<SuitabilityResult<VenueRequirements>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, reason: SUITABILITY_MESSAGES.notSignedIn }

  const clean = normaliseRequirements(input)
  const { data, error } = await supabase
    .from('event_venue_requirements')
    .upsert({ event_id: eventId, ...clean, updated_by: userId }, { onConflict: 'event_id' })
    .select('layout, accessibility, facilities')
    .single()

  if (error || !data) {
    // 42501: RLS refused; only the currently assigned coordinator may write.
    if (error?.code === '42501') return { ok: false, reason: SUITABILITY_MESSAGES.saveDenied }
    // 23503: the layout is not in layout_types.
    if (error?.code === '23503') return { ok: false, reason: SUITABILITY_MESSAGES.unknownLayout }
    console.error('[venues] saveVenueRequirements', error)
    return { ok: false, reason: SUITABILITY_MESSAGES.saveFailed }
  }
  return { ok: true, value: toRequirements(data as RequirementsRow) }
}


interface VenueRow {
  id: string
  name: string
  location: string | null
  status: VenueStatus
  accessibility: string[] | null
  facility: Record<string, unknown> | null
  venue_layouts: { layout: string; capacity: number }[] | null
}

function toVenue(row: VenueRow): VenueProfile {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? '',
    status: row.status,
    accessibility: row.accessibility ?? [],
    facility: row.facility ?? {},
    layouts: row.venue_layouts ?? [],
  }
}

export async function loadLayoutTypes(): Promise<LayoutType[]> {
  const { data, error } = await supabase.from('layout_types').select('code, label').order('sort_order')
  if (error) {
    console.error('[venues] loadLayoutTypes', error)
    return []
  }
  return (data ?? []) as LayoutType[]
}

/** The cells this event's booking would need (event + setup/turnaround), and whether its times allow any. */
function bookingCells(event: SuitabilityEvent, slots: TimeSlot[]): { timing: TimingState; cells: SlotCell[] } {
  if (!event.proposedStart || !event.proposedEnd) return { timing: 'missing', cells: [] }
  const cells = claimsForEvent(new Date(event.proposedStart), new Date(event.proposedEnd), slots)
  return { timing: cells.length === 0 ? 'outside_slots' : 'ok', cells }
}

/** AC-018.1/.3/.4. Every non-retired venue assessed for one event: verdict and reasons.
 *  Retired venues are left out entirely; they are not an option to consider. */
export async function assessVenuesForEvent(
  eventId: string,
  slots: TimeSlot[],
): Promise<SuitabilityResult<VenueAssessment[]>> {
  const context = await loadEventSuitability(eventId)
  if (!context.ok) return context
  const { event, requirements } = context.value

  const { data: venueRows, error: venueError } = await supabase
    .from('venues')
    .select('id, name, location, status, accessibility, facility, venue_layouts(layout, capacity)')
    .neq('status', 'retired')
    .order('name')
  if (venueError) {
    console.error('[venues] assessVenuesForEvent', venueError)
    return { ok: false, reason: SUITABILITY_MESSAGES.unexpected }
  }
  const venues = ((venueRows ?? []) as VenueRow[]).map(toVenue)

  const { timing } = bookingCells(event, slots)

  const labels = new Map((await loadLayoutTypes()).map((type) => [type.code, type.label]))
  const layoutLabel = (code: string) => labels.get(code) ?? code

  return {
    ok: true,
    value: sortAssessments(venues.map((venue) => evaluateVenueSuitability({
      venue,
      expectedAttendance: event.expectedAttendance,
      requirements,
      layoutLabel,
      timing,
      occupied: [],
    }))),
  }
}