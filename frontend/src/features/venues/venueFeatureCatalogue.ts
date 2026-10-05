/**
 * PURE MODULE. One list of accessibility and facility codes for search (US8) and
 * suitability (US18). venues.accessibility holds the accessibility codes; the keys of
 * venues.facility hold the facility codes. Placeholder codes from US8 until a catalogue table exists.
 */
export interface FeatureOption {
  code: string
  label: string
}

export const ACCESSIBILITY_OPTIONS: readonly FeatureOption[] = [
  { code: 'wheelchair_access', label: 'Wheelchair access' },
  { code: 'hearing_loop', label: 'Hearing loop' },
  { code: 'accessible_toilet', label: 'Accessible toilet' },
  { code: 'lift_access', label: 'Lift access' },
]

export const FACILITY_OPTIONS: readonly FeatureOption[] = [
  { code: 'projector', label: 'Projector' },
  { code: 'microphone', label: 'Microphone' },
  { code: 'stage', label: 'Stage' },
  { code: 'wifi', label: 'Wi-Fi' },
]

/** A readable name for a stored code. An unknown code is shown as itself, never dropped. */
export function featureLabel(options: readonly FeatureOption[], code: string): string {
  return options.find((option) => option.code === code)?.label ?? code
}