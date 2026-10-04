import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReservationQueue } from '../components/ReservationQueue'
import type { Viewer } from '../types'
import type { ReviewQueueItem } from '../reservationTypes'

const mocks = vi.hoisted(() => ({ queue: vi.fn(), reserve: vi.fn(), catalogue: vi.fn() }))
vi.mock('../reservationService', () => ({
  RESERVATION_MESSAGES: { loadFailed: 'Could not load.', saveFailed: 'Could not save.' },
  loadReviewQueue: mocks.queue, reserveRequirement: mocks.reserve,
}))
vi.mock('../equipmentRequirementService', () => ({
  EQUIPMENT_SERVICE_MESSAGES: { catalogueFailed: 'Catalogue failed.' },
  loadCatalogue: mocks.catalogue,
}))

const techSupport: Viewer = { id: 'tech-1', role: 'tech_support' }
const item: ReviewQueueItem = {
  requirementId: 'req-1', eventId: 'event-1', eventReference: 'EVT-2026-0001', eventName: 'Launch',
  eventStart: '2035-03-09T16:30:00Z', eventEnd: '2035-03-11T09:00:00Z', typeId: 'projector',
  typeName: 'Projector', quantityRequested: 2, technicalNotes: null, available: 3,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.catalogue.mockResolvedValue({ ok: true, data: [{ id: 'projector', name: 'Projector', category: 'Visual' }] })
})

describe('AC-014.1: the review queue', () => {
  test('AC-014.1.7: lists each requirement pending review', async () => {
    mocks.queue.mockResolvedValue({ ok: true, data: [item, { ...item, requirementId: 'req-2', eventReference: 'EVT-2026-0002' }] })
    render(<ReservationQueue viewer={techSupport} />)
    expect(await screen.findByText('EVT-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('EVT-2026-0002')).toBeInTheDocument()
    expect(screen.getAllByText('Projector')).toHaveLength(2)
  })
  test('AC-014.1.8: says so when nothing is pending', async () => {
    mocks.queue.mockResolvedValue({ ok: true, data: [] })
    render(<ReservationQueue viewer={techSupport} />)
    expect(await screen.findByText('No equipment requirements pending review.')).toBeInTheDocument()
  })
})

describe('AC-014.2: available units per requirement', () => {
  test('AC-014.2.5: each row shows available against requested', async () => {
    mocks.queue.mockResolvedValue({ ok: true, data: [item] })
    render(<ReservationQueue viewer={techSupport} />)
    expect(await screen.findByText('3 available · 2 requested')).toBeInTheDocument()
  })
  test('AC-014.2.6: a shortfall is highlighted', async () => {
    mocks.queue.mockResolvedValue({ ok: true, data: [{ ...item, available: 1 }] })
    render(<ReservationQueue viewer={techSupport} />)
    expect(await screen.findByText('Short by 1')).toBeInTheDocument()
  })
})

describe('AC-014.7: only technical support reserves', () => {
  test('AC-014.7.8: other roles see no reserve screen (courtesy only)', async () => {
    render(<ReservationQueue viewer={{ id: 'coordinator-1', role: 'coordinator' }} />)
    expect(screen.getByText('This page is for Technical Support staff.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.queue).not.toHaveBeenCalled())
  })
})

describe('AC-014.8: full or partial reservation', () => {
  test('AC-014.8.11: after reserving, the row leaves the queue with its outcome shown', async () => {
    mocks.queue.mockResolvedValue({ ok: true, data: [item] })
    mocks.reserve.mockResolvedValue({ ok: true, data: { status: 'reserved', reserved: 2, requested: 2 } })
    const user = userEvent.setup()
    render(<ReservationQueue viewer={techSupport} />)
    await user.click(await screen.findByRole('button', { name: 'Review Projector for EVT-2026-0001' }))
    await user.click(await screen.findByRole('button', { name: 'Reserve' }))
    expect(await screen.findByText(/Reserved 2 of 2/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review Projector for EVT-2026-0001' })).not.toBeInTheDocument()
  })
})
