import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../../components/ui/Button'
import { Field, TextInput } from '../../../components/ui/FormControls'
import { reserveRequirement } from '../reservationService'
import { formatDay, reservationWindow, reserveFormSchema, shortfallFor } from '../reservationRules'
import { ShortfallFields } from './ShortfallFields'
import type { EquipmentType } from '../types'
import type { ReservationOutcome, ReserveFormValues, ReviewQueueItem } from '../reservationTypes'

interface ReserveFormProps {
  item: ReviewQueueItem
  catalogue: EquipmentType[]
  onReserved: (outcome: ReservationOutcome) => void
  onCancel: () => void
}

export function ReserveForm({ item, catalogue, onReserved, onCancel }: ReserveFormProps) {
  const span = reservationWindow(item.eventStart, item.eventEnd)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ReserveFormValues>({
    resolver: zodResolver(reserveFormSchema(item)),
    defaultValues: {
      // The most that can be reserved; a smaller number is only valid for a shortfall (A3).
      quantity: String(Math.min(item.quantityRequested, item.available)),
      returnDate: span.lastDay,
      alternativeTypeId: '',
      alternativeNote: '',
    },
  })
  const [saveError, setSaveError] = useState<string | null>(null)
  const shortfall = shortfallFor(watch('quantity'), item)
  const returnDate = watch('returnDate') || span.lastDay

  async function submit(values: ReserveFormValues) {
    setSaveError(null)
    const hasShortfall = shortfallFor(values.quantity, item) > 0
    const result = await reserveRequirement({
      requirementId: item.requirementId,
      quantity: Number(values.quantity.trim()),
      returnDate: values.returnDate,
      // Alternatives only accompany a shortfall; the database rejects them otherwise.
      alternativeTypeId: hasShortfall && values.alternativeTypeId ? values.alternativeTypeId : null,
      alternativeNote: hasShortfall ? values.alternativeNote.trim() || null : null,
    })
    if (result.ok) onReserved(result.data)
    else setSaveError(result.reason)
  }

  return <form onSubmit={handleSubmit(submit)} noValidate aria-label={`Reserve ${item.typeName}`}
    className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    {/* Units held elsewhere start one day earlier; the database applies that per unit. */}
    <p className="text-sm text-slate-700">Collection {formatDay(span.collectionDay)} · Return {formatDay(returnDate)}</p>
    <Field id="reserve-quantity" label="Quantity to reserve" error={errors.quantity?.message}
      hint={`${item.available} available · ${item.quantityRequested} requested`}>
      <TextInput id="reserve-quantity" inputMode="numeric" aria-invalid={Boolean(errors.quantity)} {...register('quantity')} />
    </Field>
    <Field id="reserve-return" label="Return date" error={errors.returnDate?.message}
      hint="Defaults to the event's last day. Units are free again the day after.">
      <TextInput id="reserve-return" type="date" min={span.lastDay} aria-invalid={Boolean(errors.returnDate)}
        {...register('returnDate')} />
    </Field>
    {shortfall > 0 && <ShortfallFields shortfall={shortfall} requestedTypeId={item.typeId} catalogue={catalogue}
      register={register} alternativeError={errors.alternativeTypeId?.message} />}
    {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
    <div className="flex gap-3">
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Reserving…' : 'Reserve'}</Button>
      <button type="button" onClick={onCancel} className="text-sm text-slate-600">Cancel</button>
    </div>
  </form>
}
