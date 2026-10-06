import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const optionRows = z.array(z.object({
  coordinator_id: z.string().uuid(),
  full_name: z.string(),
  active_event_count: z.number().int().nonnegative().safe(),
}))

export interface CoordinatorOption {
  id: string
  name: string
  activeEventCount: number
}
type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

export async function listAssignmentCoordinators(): Promise<Result<CoordinatorOption[]>> {
  const failed = { ok: false as const, reason: 'The coordinator list could not be loaded. Please try again.' }
  try {
    const { data, error } = await supabase.rpc('list_assignment_coordinators')
    if (error) return failed
    const parsed = optionRows.safeParse(data)
    if (!parsed.success) return failed
    return { ok: true, value: parsed.data.map(row => ({
      id: row.coordinator_id, name: row.full_name, activeEventCount: row.active_event_count,
    })) }
  } catch {
    return failed
  }
}

export async function assignEventCoordinator(eventId: string, coordinatorId: string): Promise<Result<null>> {
  if (!z.string().uuid().safeParse(eventId).success || !z.string().uuid().safeParse(coordinatorId).success) {
    return { ok: false, reason: 'Choose a coordinator for a valid event before saving.' }
  }
  try {
    // The database derives the caller from the session and checks role, target and lifecycle.
    const { error } = await supabase.rpc('assign_event_coordinator', {
      p_event_id: eventId, p_coordinator_id: coordinatorId,
    })
    if (error) return { ok: false, reason: error.code === '42501'
      ? 'Only a Coordinator Lead can save this assignment.'
      : error.code === '22000'
        ? 'The event or coordinator is no longer available for assignment. Refresh requests and try again.'
        : 'The assignment could not be saved. Please try again.' }
    return { ok: true, value: null }
  } catch {
    // A lost response does not prove a write failed. Never retry automatically.
    return { ok: false, reason: 'The assignment could not be confirmed. Refresh requests to check before trying again.' }
  }
}
