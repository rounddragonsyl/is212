import type { EventStatus } from '../events/types'
import type {
  EquipmentRequirement, EquipmentType, RequirementDisplayStatus, RequirementFieldErrors, RequirementFormInput,
  RequirementInput, RequirementStatus, RequirementValidationResult, Viewer,
} from './types'

export const REQUIREMENT_MESSAGES = {
  typeRequired: 'Choose an equipment type.',
  typeNotInCatalogue: 'Choose an equipment type from the catalogue.',
  quantityRequired: 'Enter a quantity.',
  quantityWhole: 'Quantity must be a whole number.',
  quantityMin: 'Quantity must be at least 1.',
} as const

export const REQUIREMENT_STATUS_LABELS: Record<RequirementDisplayStatus, string> = {
  pending_review: 'Pending review',
  reserved: 'Reserved',
  partially_reserved: 'Partially reserved',
  unavailable: 'Unavailable',
  non_essential: 'Non-essential',
}

// Equipment is worked out while an event is planned, so the window stays open after
// approval until the event is confirmed. Mirrors guard_equipment_requirement_change in 0020.
export const EQUIPMENT_EDITABLE_STATUSES: readonly EventStatus[] = ['approved', 'planning', 'confirmed']
const HELD_STATUSES: readonly RequirementStatus[] = ['reserved', 'partially_reserved']

/** UX only: hides controls the database would refuse. RLS in 0020 is the actual control. */
export function canManageRequirements(
  event: { status: EventStatus; coordinatorId: string | null },
  viewer: Viewer,
): boolean {
  return viewer.role === 'coordinator'
    && event.coordinatorId !== null
    && event.coordinatorId === viewer.id
    && EQUIPMENT_EDITABLE_STATUSES.includes(event.status)
}

function quantityError(raw: string | number): string | null {
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return REQUIREMENT_MESSAGES.quantityRequired
    // Stricter than Number(): "1e2" or "0x10" are not quantities a person types.
    if (!/^-?\d+$/.test(text)) return REQUIREMENT_MESSAGES.quantityWhole
  } else if (!Number.isInteger(raw)) {
    return REQUIREMENT_MESSAGES.quantityWhole
  }
  return Number(raw) < 1 ? REQUIREMENT_MESSAGES.quantityMin : null
}

export function validateRequirement(
  input: RequirementFormInput,
  catalogue: EquipmentType[],
): RequirementValidationResult {
  const errors: RequirementFieldErrors = {}
  const typeId = input.typeId.trim()
  if (!typeId) errors.typeId = REQUIREMENT_MESSAGES.typeRequired
  else if (!catalogue.some(({ id }) => id === typeId)) errors.typeId = REQUIREMENT_MESSAGES.typeNotInCatalogue

  const quantityProblem = quantityError(input.quantity)
  if (quantityProblem) errors.quantity = quantityProblem

  if (errors.typeId || errors.quantity) return { ok: false, errors }
  return {
    ok: true,
    value: {
      typeId,
      quantity: Number(input.quantity),
      technicalNotes: input.technicalNotes?.trim() || null,
      essential: input.essential ?? true,
    },
  }
}

/** Held equipment is the more useful fact, so it outranks the non-essential flag. */
export function requirementDisplayStatus(status: RequirementStatus, essential: boolean): RequirementDisplayStatus {
  if (HELD_STATUSES.includes(status)) return status
  return essential ? status : 'non_essential'
}

/** Mirrors the 0020 trigger so the editor can warn before the database releases units. */
export function changeReturnsToPendingReview(
  before: Pick<EquipmentRequirement, 'status' | 'typeId' | 'quantity' | 'technicalNotes' | 'essential'>,
  after: RequirementInput,
): boolean {
  return HELD_STATUSES.includes(before.status)
    && (before.typeId !== after.typeId || before.quantity !== after.quantity)
}
