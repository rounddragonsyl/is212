import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Field } from '../../../components/ui/FormControls'
import type { LayoutType, VenueRequirements } from '../suitabilityTypes'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from '../venueFeatureCatalogue'
import type { FeatureOption } from '../venueFeatureCatalogue'

interface VenueRequirementsFormProps {
  layoutTypes: LayoutType[]
  initial: VenueRequirements
  /** Resolves to an error message to show, or null when saved. */
  onSave: (requirements: VenueRequirements) => Promise<string | null>
}

function toggle(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter((item) => item !== code) : [...list, code]
}

/**
 * AC-018.1: the coordinator's structured reading of the organiser's free-text needs.
 * Choices come only from the catalogues, so every saved code can be matched to a venue.
 */
export function VenueRequirementsForm({ layoutTypes, initial, onSave }: VenueRequirementsFormProps) {
  const [value, setValue] = useState<VenueRequirements>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const failure = await onSave(value)
    setSaving(false)
    setError(failure)
  }

  function featureGroup(legend: string, options: readonly FeatureOption[], key: 'accessibility' | 'facilities') {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">{legend}</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {options.map((option) => (
            <label key={option.code} className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={value[key].includes(option.code)}
                onChange={() => setValue({ ...value, [key]: toggle(value[key], option.code) })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Venue requirements">
      <Field id="requirement-layout" label="Layout">
        <select
          id="requirement-layout"
          value={value.layout ?? ''}
          onChange={(event) => setValue({ ...value, layout: event.target.value || null })}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Any layout</option>
          {layoutTypes.map((type) => (
            <option key={type.code} value={type.code}>{type.label}</option>
          ))}
        </select>
      </Field>

      {featureGroup('Accessibility', ACCESSIBILITY_OPTIONS, 'accessibility')}
      {featureGroup('Facilities', FACILITY_OPTIONS, 'facilities')}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save requirements'}</Button>
    </form>
  )
}