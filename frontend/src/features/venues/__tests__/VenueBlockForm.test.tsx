import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueBlockForm } from '../components/VenueBlockForm'
import { SLOT_LABELS } from '../slotFormat'
import type { VenueBlockInput, VenueBlockPreview } from '../venueBlockTypes'
import { BLOCK_VALIDATION_MESSAGES } from '../venueBlockValidation'

const NOTHING: VenueBlockPreview = { affectedBookings: [], existingBlocks: [] }

const ENTERED: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-10',
  slots: ['AM'],
  reason: 'Ceiling repair',
}

const previewing = (value: VenueBlockPreview = NOTHING) => vi.fn().mockResolvedValue({ ok: true, value })
const saving = (flaggedBookings: number | null = 0) =>
  vi.fn().mockResolvedValue({ ok: true, value: { blockId: 'block-1', flaggedBookings } })

function fillIn(reason = ENTERED.reason) {
  fireEvent.change(screen.getByLabelText(/First day/), { target: { value: ENTERED.startsOn } })
  fireEvent.change(screen.getByLabelText(/Last day/), { target: { value: ENTERED.endsOn } })
  fireEvent.click(screen.getByLabelText(SLOT_LABELS.AM))
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: reason } })
}

describe('AC-012.3 — a reason is required', () => {
  test('AC-012.3.7: a blank reason shows its message beside the field, and nothing is previewed', async () => {
    const onPreview = previewing()
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={saving()} />)

    fillIn('   ')
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(BLOCK_VALIDATION_MESSAGES.reasonRequired)
    expect(onPreview).not.toHaveBeenCalled()
  })
})

describe('AC-012.7 — overlaps are previewed before saving', () => {
  test('AC-012.7.12: Confirm block appears only after a preview, and confirms what was previewed', async () => {
    const onPreview = previewing()
    const onCreate = saving()
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={onCreate} />)

    fillIn()
    expect(screen.queryByRole('button', { name: 'Confirm block' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))

    expect(onPreview).toHaveBeenCalledWith(ENTERED)
    expect(onCreate).toHaveBeenCalledWith(ENTERED)
  })
})
