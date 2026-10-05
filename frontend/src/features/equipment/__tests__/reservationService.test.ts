import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  RESERVATION_MESSAGES as messages, changeReturnDate, loadOutcomeNotices, loadReviewQueue, reserveRequirement,
} from '../reservationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))

type QueryResult = { data: unknown; error: unknown }
function query(result: QueryResult) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const method of [builder.select, builder.eq, builder.in, builder.order]) method.mockReturnValue(builder)
  mocks.from.mockReturnValue(builder)
  return builder
}

const queueRow = {
  requirement_id: 'req-1', event_id: 'event-1', event_reference: 'EVT-2026-0001', event_name: 'Launch',
  proposed_start: '2035-03-09T16:30:00Z', proposed_end: '2035-03-11T09:00:00Z',
  type_id: 'projector', type_name: 'Projector', quantity_requested: 2, technical_notes: 'HDMI', available: 3,
}
const input = {
  requirementId: 'req-1', quantity: 2, returnDate: '2035-03-11', alternativeTypeId: null, alternativeNote: null,
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-014.1: the review queue', () => {
  test('AC-014.1.5: loads and maps the requirements pending review', async () => {
    mocks.rpc.mockResolvedValue({ data: [queueRow], error: null })
    expect(await loadReviewQueue()).toEqual({
      ok: true,
      data: [{
        requirementId: 'req-1', eventId: 'event-1', eventReference: 'EVT-2026-0001', eventName: 'Launch',
        eventStart: '2035-03-09T16:30:00Z', eventEnd: '2035-03-11T09:00:00Z', typeId: 'projector',
        typeName: 'Projector', quantityRequested: 2, technicalNotes: 'HDMI', available: 3,
      }],
    })
    expect(mocks.rpc).toHaveBeenCalledWith('equipment_review_queue')
  })
  test('AC-014.1.6: a load failure returns a clear error and no data', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private details' } })
    expect(await loadReviewQueue()).toEqual({ ok: false, reason: messages.loadFailed })
  })
})

describe('AC-014.4: changing the return date', () => {
  test('AC-014.4.11: a return-date change calls the database and explains a clash', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23P01', message: 'clash' } })
    expect(await changeReturnDate({ requirementId: 'req-1', returnDate: '2035-03-13' }))
      .toEqual({ ok: false, reason: messages.returnConflict })
    expect(messages.returnConflict).toMatch(/already reserved/)
    expect(mocks.rpc).toHaveBeenCalledWith('change_equipment_return_date', {
      p_requirement_id: 'req-1', p_return_date: '2035-03-13',
    })
  })
})

describe('AC-014.7: only technical support reserves', () => {
  test('AC-014.7.9: a permission refusal is explained', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    expect(await reserveRequirement(input)).toEqual({
      ok: false, reason: 'Only Technical Support Staff can reserve equipment.',
    })
  })
})

describe('AC-014.8: full or partial reservation', () => {
  test('AC-014.8.10: a reservation sends only the decision, never units, user or status', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'reserved', reserved: 2, requested: 2 }, error: null })
    expect(await reserveRequirement(input)).toEqual({ ok: true, data: { status: 'reserved', reserved: 2, requested: 2 } })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('reserve_equipment', {
      p_requirement_id: 'req-1', p_quantity: 2, p_return_date: '2035-03-11',
      p_alternative_type_id: null, p_alternative_note: null,
    })
  })
})

describe('AC-014.13: coordinator outcome notices', () => {
  test('AC-014.13.9: loads the event outcome notices, newest first', async () => {
    const row = (id: string, createdAt: string, action: string) => ({
      id, action, type_name: 'Projector', quantity: 3, quantity_reserved: 2,
      alternative_type_name: null, alternative_note: null, created_at: createdAt,
    })
    const builder = query({
      data: [row('n1', '2035-01-01T00:00:00Z', 'reserved'), row('n2', '2035-01-02T00:00:00Z', 'partially_reserved')],
      error: null,
    })
    const result = await loadOutcomeNotices('event-1')
    expect(result.ok && result.data.map(({ id }) => id)).toEqual(['n2', 'n1'])
    expect(result.ok && result.data[0]).toEqual({
      id: 'n2', action: 'partially_reserved', typeName: 'Projector', quantity: 3, quantityReserved: 2,
      alternativeTypeName: null, alternativeNote: null, createdAt: '2035-01-02T00:00:00Z',
    })
    expect(mocks.from).toHaveBeenCalledWith('equipment_requirement_notifications')
    expect(builder.eq).toHaveBeenCalledWith('event_id', 'event-1')
    expect(builder.in).toHaveBeenCalledWith('action', ['reserved', 'partially_reserved', 'unavailable'])
  })
})
