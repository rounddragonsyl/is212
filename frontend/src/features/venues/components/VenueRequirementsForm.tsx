import type { LayoutType, VenueRequirements } from '../suitabilityTypes'

interface VenueRequirementsFormProps {
  layoutTypes: LayoutType[]
  initial: VenueRequirements
  /** Resolves to an error message to show, or null when saved. */
  onSave: (requirements: VenueRequirements) => Promise<string | null>
}

export function VenueRequirementsForm(props: VenueRequirementsFormProps) {
  void props
  return null
}