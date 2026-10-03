import type { EventStatus } from '../events/types'
import type {
  EquipmentRequirement, EquipmentType, RequirementDisplayStatus, RequirementFormInput, RequirementInput,
  RequirementStatus, RequirementValidationResult, Viewer,
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

// Step 3 stubs: signatures only. Implemented in Step 4.
export function canManageRequirements(
  _event: { status: EventStatus; coordinatorId: string | null },
  _viewer: Viewer,
): boolean {
  throw new Error('Not implemented')
}

export function validateRequirement(
  _input: RequirementFormInput,
  _catalogue: EquipmentType[],
): RequirementValidationResult {
  throw new Error('Not implemented')
}

export function requirementDisplayStatus(_status: RequirementStatus, _essential: boolean): RequirementDisplayStatus {
  throw new Error('Not implemented')
}

export function changeReturnsToPendingReview(
  _before: Pick<EquipmentRequirement, 'status' | 'typeId' | 'quantity' | 'technicalNotes' | 'essential'>,
  _after: RequirementInput,
): boolean {
  throw new Error('Not implemented')
}
