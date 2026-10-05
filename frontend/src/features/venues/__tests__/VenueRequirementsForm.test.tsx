import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueRequirementsForm } from '../components/VenueRequirementsForm'

const LAYOUTS = [{ code: 'theatre', label: 'Theatre' }, { code: 'boardroom', label: 'Boardroom' }]
const EMPTY = { layout: null, accessibility: [], facilities: [] }

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test('AC-018.1.25: choosing a layout and features, then saving, sends structured requirements', async () => {
    const onSave = vi.fn().mockResolvedValue(null)
    render(<VenueRequirementsForm layoutTypes={LAYOUTS} initial={EMPTY} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'boardroom' } })
    fireEvent.click(screen.getByLabelText('Hearing loop'))
    fireEvent.click(screen.getByLabelText('Projector'))
    fireEvent.click(screen.getByRole('button', { name: 'Save requirements' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      layout: 'boardroom', accessibility: ['hearing_loop'], facilities: ['projector'],
    }))
  })

  test('AC-018.1.26: requirements saved earlier are shown filled in', () => {
    render(<VenueRequirementsForm
      layoutTypes={LAYOUTS}
      initial={{ layout: 'theatre', accessibility: ['wheelchair_access'], facilities: [] }}
      onSave={vi.fn()}
    />)
    expect(screen.getByLabelText('Layout')).toHaveValue('theatre')
    expect(screen.getByLabelText('Wheelchair access')).toBeChecked()
    expect(screen.getByLabelText('Projector')).not.toBeChecked()
  })

  test('AC-018.1.27: if saving fails, the reason is shown', async () => {
    const onSave = vi.fn().mockResolvedValue('Only the coordinator assigned to this event can change its venue requirements.')
    render(<VenueRequirementsForm layoutTypes={LAYOUTS} initial={EMPTY} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save requirements' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the coordinator assigned to this event')
  })
})