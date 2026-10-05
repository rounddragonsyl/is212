import { Checkbox } from '../../../components/ui/FormControls'
import { SLOT_LABELS } from '../slotFormat'
import type { SlotCode } from '../slots'
import { BLOCK_SLOTS } from '../venueBlockValidation'

interface SlotPickerProps {
  id: string
  value: SlotCode[]
  onChange: (slots: SlotCode[]) => void
  disabled?: boolean
  error?: string
}

/**
 * AC-012.2: one or more of AM, PM and Night. "Full day" is a shortcut for all three, not a
 * fourth slot, so the value is only ever slot codes.
 */
export function SlotPicker({ id, value, onChange, disabled, error }: SlotPickerProps) {
  const fullDay = BLOCK_SLOTS.every((code) => value.includes(code))
  const toggle = (code: SlotCode) =>
    onChange(value.includes(code) ? value.filter((slot) => slot !== code) : [...value, code])

  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium text-slate-700">
        Slots
        <span className="ml-1 text-red-600" aria-label="required">
          *
        </span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Checkbox
            checked={fullDay}
            disabled={disabled}
            onChange={() => onChange(fullDay ? [] : [...BLOCK_SLOTS])}
          />
          Full day
        </label>
        {BLOCK_SLOTS.map((code) => (
          <label key={code} className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={value.includes(code)} disabled={disabled} onChange={() => toggle(code)} />
            {SLOT_LABELS[code]}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
