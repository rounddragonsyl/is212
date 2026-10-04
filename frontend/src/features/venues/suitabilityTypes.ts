import type { VenueStatus } from './types'

/** The coordinator's structured reading of the organiser's free-text venue needs. */
export interface VenueRequirements {
  layout: string | null
  accessibility: string[]
  facilities: string[]
}

export interface VenueLayoutCapacity {
  layout: string
  capacity: number
}

export interface VenueProfile {
  id: string
  name: string
  location: string
  status: VenueStatus
  layouts: VenueLayoutCapacity[]
  accessibility: string[]
  facility: Record<string, unknown>
}

export type SuitabilityReasonCode = 'capacity' | 'layout' | 'accessibility' | 'facility'

export interface SuitabilityReason {
  code: SuitabilityReasonCode
  message: string
}

export type SuitabilityVerdict = 'suitable' | 'unsuitable'

export interface VenueAssessment {
  venue: VenueProfile
  verdict: SuitabilityVerdict
  reasons: SuitabilityReason[]
  /** Layouts that can hold the expected attendance, so the coordinator sees the options. */
  fittingLayouts: VenueLayoutCapacity[]
}