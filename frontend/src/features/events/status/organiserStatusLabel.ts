import { EVENT_STATUS_LABELS } from '../types'
import type { EventStatus } from '../types'

/** Presentation only: the coordinator workflow keeps its existing database states. */
export function organiserStatusLabel(status: EventStatus, reviewNote?: string | null): string {
  if (status === 'submitted' && reviewNote?.trim()) return 'Clarification required'
  if (status === 'submitted' || status === 'under_review') return 'In review'
  return EVENT_STATUS_LABELS[status]
}
