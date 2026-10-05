import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SlotPicker } from '../components/SlotPicker'
import { SLOT_LABELS } from '../slotFormat'

describe('AC-012.2 — one or more slots', () => {
  test('AC-012.2.26: Full day chooses all three slots, and unticking it clears them', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SlotPicker id="slots" value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith(['AM', 'PM', 'NIGHT'])

    rerender(<SlotPicker id="slots" value={['AM', 'PM', 'NIGHT']} onChange={onChange} />)
    expect(screen.getByLabelText('Full day')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  test('AC-012.2.27: a single slot can be added on its own, without ticking Full day', () => {
    const onChange = vi.fn()
    render(<SlotPicker id="slots" value={['AM']} onChange={onChange} />)

    expect(screen.getByLabelText('Full day')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText(SLOT_LABELS.NIGHT))
    expect(onChange).toHaveBeenLastCalledWith(['AM', 'NIGHT'])
  })
})
