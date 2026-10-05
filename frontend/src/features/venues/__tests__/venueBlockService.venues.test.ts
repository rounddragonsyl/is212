import { beforeEach, describe, expect, test, vi } from 'vitest'
import { listBlockableVenues, VENUE_BLOCK_MESSAGES } from '../venueBlockService'
import { mockQuery } from './mockQuery'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

describe('AC-012.2 — choosing the venue to block', () => {
  test('AC-012.2.29: the venues offered for blocking leave out retired ones, in name order', async () => {
    const query = mockQuery({ data: [{ id: 'v1', name: 'Main Hall', location: null }], error: null })
    mocks.from.mockReturnValue(query)

    expect(await listBlockableVenues()).toStrictEqual({
      ok: true,
      value: [{ id: 'v1', name: 'Main Hall', location: '' }],
    })
    expect(mocks.from).toHaveBeenCalledWith('venues')
    expect(query.neq).toHaveBeenCalledWith('status', 'retired')
    expect(query.order).toHaveBeenCalledWith('name')
  })

  test('AC-012.2.30: if the venues cannot be loaded, the user is told', async () => {
    mocks.from.mockReturnValue(mockQuery({ data: null, error: { message: 'timeout' } }))
    expect(await listBlockableVenues()).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.venuesFailed })
  })
})
