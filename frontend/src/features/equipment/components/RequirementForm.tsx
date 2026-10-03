import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { changeReturnsToPendingReview, validateRequirement } from '../validation'
import type { EquipmentRequirement, EquipmentType, RequirementFieldErrors, RequirementFormInput } from '../types'

interface RequirementFormProps {
  catalogue: EquipmentType[]
  catalogueError: string | null
  /** The line being edited, or null when adding. */
  editing: EquipmentRequirement | null
  busy: boolean
  onSubmit: (input: RequirementFormInput) => Promise<boolean>
  onCancel: () => void
}

type FormState = { typeId: string; quantity: string; technicalNotes: string; essential: boolean }
const EMPTY: FormState = { typeId: '', quantity: '', technicalNotes: '', essential: true }

function initialState(editing: EquipmentRequirement | null): FormState {
  return editing
    ? { typeId: editing.typeId, quantity: String(editing.quantity), technicalNotes: editing.technicalNotes ?? '', essential: editing.essential }
    : EMPTY
}

const selectClasses = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm'

/** Remount with a new key to switch between adding and editing a line. */
export function RequirementForm({ catalogue, catalogueError, editing, busy, onSubmit, onCancel }: RequirementFormProps) {
  const [form, setForm] = useState<FormState>(() => initialState(editing))
  const [errors, setErrors] = useState<RequirementFieldErrors>({})
  const unusable = Boolean(catalogueError) || catalogue.length === 0

  // Warn while typing, before the database releases anything (AC-013.6).
  const preview = editing ? validateRequirement(form, catalogue) : null
  const willRelease = Boolean(editing && preview?.ok && changeReturnsToPendingReview(editing, preview.value))

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateRequirement(form, catalogue)
    if (!validation.ok) { setErrors(validation.errors); return }
    setErrors({})
    if (await onSubmit(form) && !editing) setForm(EMPTY)
  }

  return <form onSubmit={submit} noValidate aria-label={editing ? `Edit ${editing.typeName}` : 'Add equipment requirement'}
    className="space-y-3 rounded-xl border border-slate-200 p-4">
    <h2 className="text-sm font-semibold text-slate-900">{editing ? `Edit ${editing.typeName}` : 'Add equipment requirement'}</h2>
    {catalogueError && <p role="alert" className="text-sm text-red-700">{catalogueError}</p>}
    {!catalogueError && catalogue.length === 0 && <p className="text-sm text-slate-600">No equipment types in the catalogue yet.</p>}
    <fieldset disabled={busy || unusable} className="space-y-3">
      <Field id="equipment-type" label="Equipment type" error={errors.typeId}>
        <select id="equipment-type" value={form.typeId} aria-invalid={Boolean(errors.typeId)}
          onChange={(event) => update('typeId', event.target.value)} className={selectClasses}>
          <option value="">Choose equipment</option>
          {catalogue.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </Field>
      {/* Text, not type="number": the browser would silently drop "1.5" or "abc" instead of
          letting validation explain what is wrong. */}
      <Field id="equipment-quantity" label="Quantity" error={errors.quantity}>
        <TextInput id="equipment-quantity" inputMode="numeric" value={form.quantity} aria-invalid={Boolean(errors.quantity)}
          onChange={(event) => update('quantity', event.target.value)} />
      </Field>
      <Field id="equipment-notes" label="Technical requirements" hint="Optional, for example connectors or power.">
        <TextArea id="equipment-notes" value={form.technicalNotes}
          onChange={(event) => update('technicalNotes', event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={form.essential} onChange={(event) => update('essential', event.target.checked)} />
        Essential
      </label>
      {willRelease && <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
        Saving returns this line to pending review and releases its reserved equipment.
      </p>}
    </fieldset>
    <div className="flex gap-3">
      <Button type="submit" disabled={busy || unusable}>{editing ? 'Save changes' : 'Add requirement'}</Button>
      {editing && <button type="button" onClick={onCancel} className="text-sm text-slate-600">Cancel</button>}
    </div>
  </form>
}
