import type {
  EquipmentNotification, EquipmentRequirement, EquipmentType, EventRequirements,
  RequirementFormInput, ServiceResult, TechSupportRequirement,
} from './types'

export const EQUIPMENT_SERVICE_MESSAGES = {
  forbidden: 'Only the assigned Event Coordinator can change equipment requirements.',
  notEligible: 'Equipment requirements can only be changed for approved events.',
  typeMissing: 'That equipment type is no longer in the catalogue.',
  loadFailed: 'Equipment requirements could not be loaded. Reload to try again.',
  catalogueFailed: 'The equipment catalogue could not be loaded. Reload to try again.',
  notificationsFailed: 'Equipment notifications could not be loaded. Reload to try again.',
  saveFailed: 'The change could not be confirmed. Reload to check it before trying again.',
} as const

// Step 3 stubs: signatures only. Implemented in Step 4.
export async function loadEventRequirements(_eventId: string): Promise<ServiceResult<EventRequirements>> {
  throw new Error('Not implemented')
}

export async function loadCatalogue(): Promise<ServiceResult<EquipmentType[]>> {
  throw new Error('Not implemented')
}

export async function addRequirement(
  _eventId: string, _input: RequirementFormInput, _catalogue: EquipmentType[],
): Promise<ServiceResult<EquipmentRequirement>> {
  throw new Error('Not implemented')
}

export async function updateRequirement(
  _requirementId: string, _input: RequirementFormInput, _catalogue: EquipmentType[],
): Promise<ServiceResult<EquipmentRequirement>> {
  throw new Error('Not implemented')
}

export async function removeRequirement(_requirementId: string): Promise<ServiceResult<null>> {
  throw new Error('Not implemented')
}

export async function loadAllRequirements(): Promise<ServiceResult<TechSupportRequirement[]>> {
  throw new Error('Not implemented')
}

export async function loadMyEquipmentNotifications(): Promise<ServiceResult<EquipmentNotification[]>> {
  throw new Error('Not implemented')
}
