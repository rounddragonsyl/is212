import type { VenueAssessment } from '../suitabilityTypes'

interface SuitabilityResultListProps {
  assessments: VenueAssessment[]
  layoutLabel: (code: string) => string
}

export function SuitabilityResultList(props: SuitabilityResultListProps) {
  void props
  return null
}