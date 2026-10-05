import type { UseFormRegister } from 'react-hook-form'
import { Field, TextArea } from '../../../components/ui/FormControls'
import type { EquipmentType } from '../types'
import type { ReserveFormValues } from '../reservationTypes'

interface ShortfallFieldsProps {
  shortfall: number
  requestedTypeId: string
  catalogue: EquipmentType[]
  register: UseFormRegister<ReserveFormValues>
  alternativeError?: string
}

const selectClasses = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm'

/** Shown only for a shortfall (AC-014.9): the uncovered units are marked unavailable and a
 * different catalogue type can be suggested (0019's structured alternative). */
export function ShortfallFields({ shortfall, requestedTypeId, catalogue, register, alternativeError }: ShortfallFieldsProps) {
  const alternatives = catalogue.filter((type) => type.id !== requestedTypeId)
  return <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
    <p className="text-sm font-medium text-amber-800">Shortfall: {shortfall}</p>
    <p className="text-xs text-amber-800">The shortfall is marked unavailable for the coordinator.</p>
    <Field id="reserve-alternative" label="Suggested alternative" error={alternativeError}>
      <select id="reserve-alternative" className={selectClasses} {...register('alternativeTypeId')}>
        <option value="">No alternative</option>
        {alternatives.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>
    </Field>
    <Field id="reserve-note" label="Note for the coordinator">
      <TextArea id="reserve-note" {...register('alternativeNote')} />
    </Field>
  </div>
}
