import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import type { SlotCode } from '../slots'
import type { VenueBlockResult } from '../venueBlockService'
import type { VenueBlockField, VenueBlockInput, VenueBlockPreview as PreviewData } from '../venueBlockTypes'
import { sameBlock, validateVenueBlock } from '../venueBlockValidation'
import { SlotPicker } from './SlotPicker'
import { VenueBlockPreview } from './VenueBlockPreview'

type SaveResult = VenueBlockResult<{ blockId: string; flaggedBookings: number | null }>

interface VenueBlockFormProps {
  venueId: string
  onPreview: (input: VenueBlockInput) => Promise<VenueBlockResult<PreviewData>>
  onCreate: (input: VenueBlockInput) => Promise<SaveResult>
}

/** AC-012.2, 3, 7: Venue Staff enter a block, preview what it overlaps, then confirm it. */
export function VenueBlockForm({ venueId, onPreview, onCreate }: VenueBlockFormProps) {
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [slots, setSlots] = useState<SlotCode[]>([])
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Partial<Record<VenueBlockField, string>>>({})
  const [preview, setPreview] = useState<{ input: VenueBlockInput; result: PreviewData } | null>(null)
  const [busy, setBusy] = useState(false)

  const current: VenueBlockInput = { venueId, startsOn, endsOn, slots, reason }
  // A preview counts only for the venue, dates and slots it was taken for (AC-012.7).
  const shownPreview = preview && sameBlock(preview.input, current) ? preview.result : null
  const overlapsExistingBlock = (shownPreview?.existingBlocks.length ?? 0) > 0

  /** The form's own check runs first, so each problem shows beside its field. */
  function checked(): VenueBlockInput | null {
    const result = validateVenueBlock(current)
    setErrors(result.ok ? {} : result.errors)
    return result.ok ? result.value : null
  }

  async function handlePreview() {
    const input = checked()
    if (!input) return
    setBusy(true)
    const result = await onPreview(input)
    setBusy(false)
    if (result.ok) setPreview({ input, result: result.value })
  }

  function handleConfirm() {
    const input = checked()
    if (input) void onCreate(input)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="block-starts-on" label="First day" required error={errors.startsOn}>
          <TextInput
            id="block-starts-on"
            type="date"
            value={startsOn}
            aria-invalid={Boolean(errors.startsOn)}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </Field>
        <Field
          id="block-ends-on"
          label="Last day"
          required
          hint="The same as the first day, to block a single date."
          error={errors.endsOn}
        >
          <TextInput
            id="block-ends-on"
            type="date"
            value={endsOn}
            aria-invalid={Boolean(errors.endsOn)}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </Field>
      </div>

      <SlotPicker id="block-slots" value={slots} onChange={setSlots} error={errors.slots} />

      <Field
        id="block-reason"
        label="Reason"
        required
        hint="Shown to Venue Staff, and in the email to coordinators of affected bookings."
        error={errors.reason}
      >
        <TextArea
          id="block-reason"
          value={reason}
          aria-invalid={Boolean(errors.reason)}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      {shownPreview && <VenueBlockPreview preview={shownPreview} />}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={() => void handlePreview()}>
          Preview
        </Button>
        {shownPreview && (
          <Button type="button" disabled={busy || overlapsExistingBlock} onClick={handleConfirm}>
            Confirm block
          </Button>
        )}
      </div>
    </div>
  )
}
