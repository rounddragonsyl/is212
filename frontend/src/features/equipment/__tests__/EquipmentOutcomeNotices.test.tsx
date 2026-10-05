import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EquipmentOutcomeNotices } from '../components/EquipmentOutcomeNotices'
import type { OutcomeNotice } from '../reservationTypes'

const mocks = vi.hoisted(() => ({ notices: vi.fn() }))
vi.mock('../reservationService', () => ({
  RESERVATION_MESSAGES: { noticesFailed: 'Could not load updates.' },
  loadOutcomeNotices: mocks.notices,
}))

const notice = (id: string, overrides: Partial<OutcomeNotice>): OutcomeNotice => ({
  id, action: 'reserved', typeName: 'Projector', quantity: 2, quantityReserved: 2,
  alternativeTypeName: null, alternativeNote: null, createdAt: '2035-01-01T00:00:00Z', ...overrides,
})

beforeEach(() => { vi.resetAllMocks() })

describe('AC-014.13: the coordinator is notified of each outcome', () => {
  test('AC-014.13.10: the equipment page shows each outcome to the coordinator', async () => {
    mocks.notices.mockResolvedValue({
      ok: true,
      data: [
        notice('n1', {}),
        notice('n2', { action: 'partially_reserved', quantity: 3, quantityReserved: 2 }),
        notice('n3', { action: 'unavailable', quantityReserved: 0, alternativeTypeName: 'Speaker', alternativeNote: 'Use PA' }),
      ],
    })
    render(<EquipmentOutcomeNotices eventId="event-1" />)
    expect(await screen.findByText(/Reserved 2 of 2/)).toBeInTheDocument()
    expect(screen.getByText(/Partially reserved 2 of 3 \(short 1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Unavailable, suggested Speaker/)).toBeInTheDocument()
    expect(mocks.notices).toHaveBeenCalledWith('event-1')
  })
  test('AC-014.13.11: nothing is shown before any outcome', async () => {
    mocks.notices.mockResolvedValue({ ok: true, data: [] })
    const { container } = render(<EquipmentOutcomeNotices eventId="event-1" />)
    await waitFor(() => expect(mocks.notices).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
