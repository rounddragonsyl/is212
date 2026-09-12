export const EVENT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'planning',
  'confirmed',
  'completed',
  'cancelled',
  'rejected',
] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

// Stored lowercase so the value matches the database CHECK constraint exactly; the
// human-facing wording AC-005.3/AC-005.5 asks for is a presentation concern.
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  planning: 'Planning',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

/**
 * What a form (or a test) hands to validation: every field optional and text-shaped,
 * because that is what an HTML form produces. Validation is what turns this into a
 * SubmittableEventRequest; nothing else in the app should assume these are present.
 */
export interface EventRequestInput {
  name?: string
  purpose?: string
  eventType?: string
  description?: string
  proposedStart?: string
  proposedEnd?: string
  expectedAttendance?: string | number
  programme?: string
  layoutPreference?: string
  accessibilityRequirements?: string
  equipmentRequirements?: string
  registrationRequired?: boolean
  specialArrangements?: string
}

/** Form state is always fully populated, unlike the partial input validation accepts. */
export interface EventRequestFormValues {
  name: string
  purpose: string
  eventType: string
  description: string
  proposedStart: string
  proposedEnd: string
  expectedAttendance: string
  programme: string
  layoutPreference: string
  accessibilityRequirements: string
  equipmentRequirements: string
  registrationRequired: boolean
  specialArrangements: string
}

/** A request that has passed every AC-005.2 rule. Only validation.ts may produce one. */
export interface SubmittableEventRequest {
  name: string | null
  purpose: string
  eventType: string | null
  description: string | null
  proposedStart: Date
  proposedEnd: Date
  expectedAttendance: number
  programme: string | null
  layoutPreference: string | null
  accessibilityRequirements: string | null
  equipmentRequirements: string | null
  registrationRequired: boolean
  specialArrangements: string | null
}

/** What the caller of the service gets back on a successful submission. */
export interface SubmittedEvent {
  id: string
  reference: string
  status: EventStatus
  submittedAt: string | null
}

/** Enough of an event to list it. Dates stay as ISO strings until something renders them. */
export interface EventRequestSummary {
  id: string
  reference: string | null
  organiserId: string
  name: string | null
  purpose: string | null
  eventType: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  status: EventStatus
  submittedAt: string | null
}

/** Everything AC-005.1 captured, for a coordinator deciding on a request. */
export interface EventRequestDetail extends EventRequestSummary {
  description: string | null
  programme: string | null
  layoutPreference: string | null
  accessibilityRequirements: string | null
  equipmentRequirements: string | null
  registrationRequired: boolean
  specialArrangements: string | null
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string | null
}

export interface ValidationIssue {
  field: keyof EventRequestFormValues | 'form'
  message: string
}

export type ValidationResult =
  | { ok: true; value: SubmittableEventRequest }
  | { ok: false; issues: ValidationIssue[] }

export type SubmitEventRequestResult =
  | { ok: true; event: SubmittedEvent }
  | { ok: false; reason: string; issues: ValidationIssue[] }
