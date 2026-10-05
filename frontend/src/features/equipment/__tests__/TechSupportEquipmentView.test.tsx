import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { TechSupportEquipmentView } from '../components/TechSupportEquipmentView'
import type { EquipmentNotification, TechSupportRequirement } from '../types'

const mocks = vi.hoisted(() => ({ requirements: vi.fn(), notifications: vi.fn() }))
vi.mock('../equipmentRequirementService', () => ({
  EQUIPMENT_SERVICE_MESSAGES: { loadFailed: 'Could not load.', notificationsFailed: 'Could not load notifications.' },
  loadAllRequirements: mocks.requirements, loadMyEquipmentNotifications: mocks.notifications,
}))

const requirements: TechSupportRequirement[] = [
  {
    id: 'req-1', eventId: 'event-1', typeId: 'projector', typeName: 'Projector', quantity: 2,
    technicalNotes: 'HDMI', essential: true, status: 'reserved', displayStatus: 'reserved',
    eventReference: 'EVT-2026-0001', eventName: 'Launch', eventStart: '2035-03-01T01:00:00Z', eventEnd: '2035-03-01T02:00:00Z',
  },
  {
    id: 'req-2', eventId: 'event-2', typeId: 'mic', typeName: 'Wireless mic', quantity: 4,
    technicalNotes: null, essential: true, status: 'pending_review', displayStatus: 'pending_review',
    eventReference: 'EVT-2026-0002', eventName: 'Gala', eventStart: '2035-04-01T01:00:00Z', eventEnd: '2035-04-01T02:00:00Z',
  },
]
const notification = (id: string, action: EquipmentNotification['action']): EquipmentNotification => ({
  id, action, eventId: 'event-1', eventReference: 'EVT-2026-0001', typeName: 'Projector', quantity: 2,
  createdAt: '2035-01-01T00:00:00Z',
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requirements.mockResolvedValue({ ok: true, data: requirements })
  mocks.notifications.mockResolvedValue({ ok: true, data: [] })
})

describe('AC-013.4: technical support views requirements and notifications', () => {
  test('AC-013.4.4: shows every requirement with its event and status, read-only', async () => {
    render(<TechSupportEquipmentView />)
    expect(await screen.findByText('EVT-2026-0001')).toBeInTheDocument()
    for (const text of ['EVT-2026-0002', 'Projector', 'Wireless mic', 'HDMI', 'Reserved', 'Pending review']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /add|edit|remove/i })).not.toBeInTheDocument()
  })
  test('AC-013.4.5: lists added, changed and removed notifications with the event and equipment', async () => {
    mocks.notifications.mockResolvedValue({
      ok: true, data: [notification('n1', 'added'), notification('n2', 'changed'), notification('n3', 'removed')],
    })
    render(<TechSupportEquipmentView />)
    const list = await screen.findByRole('list', { name: 'Equipment notifications' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/Added.*Projector.*EVT-2026-0001/),
      expect.stringMatching(/Changed.*Projector.*EVT-2026-0001/),
      expect.stringMatching(/Removed.*Projector.*EVT-2026-0001/),
    ])
  })
})
