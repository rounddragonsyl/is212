import { vi } from 'vitest'
import type { TimeSlot } from '../../slots'

export const COORDINATOR_ID = '00000000-0000-0000-0000-0000000000c0'
export const EVENT_ID = '10000000-0000-0000-0000-000000000001'
export const VENUE_ID = '20000000-0000-0000-0000-000000000001'
export const BOOKING_ID = '30000000-0000-0000-0000-000000000001'

export const SLOTS: TimeSlot[] = [
  { code: 'AM', startsAt: '07:00:00', endsAt: '12:00:00', sortOrder: 1 },
  { code: 'PM', startsAt: '13:00:00', endsAt: '18:00:00', sortOrder: 2 },
  { code: 'NIGHT', startsAt: '19:00:00', endsAt: '24:00:00', sortOrder: 3 },
]

export const SLOT_ROWS = [
  { code: 'AM', starts_at: '07:00:00', ends_at: '12:00:00', sort_order: 1 },
  { code: 'PM', starts_at: '13:00:00', ends_at: '18:00:00', sort_order: 2 },
  { code: 'NIGHT', starts_at: '19:00:00', ends_at: '24:00:00', sort_order: 3 },
]

/** A Singapore wall-clock time, shaped the way events.proposed_start reads back. */
export const sgt = (date: string, time: string) => `${date}T${time}:00+08:00`

/** An approved event the signed-in coordinator manages, running 9–11am on 12 Oct 2026. */
export const APPROVED_EVENT = {
  proposed_start: sgt('2026-10-12', '09:00'),
  proposed_end: sgt('2026-10-12', '11:00'),
  status: 'approved',
  coordinator_id: COORDINATOR_ID,
}

export const eventWith = (overrides: Record<string, unknown>) => ({ ...APPROVED_EVENT, ...overrides })

export interface FakeResult { data?: unknown; error?: unknown }

const CHAIN_METHODS = [
  'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'lt', 'gt', 'gte', 'lte',
  'in', 'or', 'ilike', 'contains', 'order', 'single', 'maybeSingle',
] as const

export type ChainMethod = (typeof CHAIN_METHODS)[number]

export type FakeQuery = Record<ChainMethod, ReturnType<typeof vi.fn>> & {
  then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>
}

/** Chainable and awaitable like Supabase's builder: every method returns the same object,
 *  and awaiting it (or calling single/maybeSingle) yields the planned { data, error }. */
function fakeQuery(result: FakeResult = {}): FakeQuery {
  const resolved = { data: null, error: null, ...result }
  const query = {
    then: (onFulfilled: (value: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  } as FakeQuery
  for (const method of CHAIN_METHODS) {
    query[method] = method === 'single' || method === 'maybeSingle'
      ? vi.fn(async () => resolved)
      : vi.fn(() => query)
  }
  return query
}

/**
 * Stands in for supabase.from(table). Results are planned per table and handed out in the
 * order that table is queried, so a test can say "the first venue_bookings query returns X,
 * the second returns Y" without caring how other tables interleave. Anything unplanned
 * resolves to { data: null, error: null }.
 */
export function createSupabaseFake() {
  const planned = new Map<string, FakeResult[]>()
  const issued: { table: string; query: FakeQuery }[] = []

  const queriesFor = (table: string) =>
    issued.filter((entry) => entry.table === table).map((entry) => entry.query)

  return {
    /** Wire in with: mocks.from.mockImplementation(fake.route) */
    route(table: string): FakeQuery {
      const query = fakeQuery(planned.get(table)?.shift())
      issued.push({ table, query })
      return query
    },
    plan(table: string, ...results: FakeResult[]): void {
      planned.set(table, [...results])
    },
    queriesFor,
    callsTo: (table: string, method: ChainMethod): unknown[][] =>
      queriesFor(table).flatMap((query) => query[method].mock.calls),
    queryThatCalled: (table: string, method: ChainMethod) =>
      queriesFor(table).find((query) => query[method].mock.calls.length > 0),
    tablesTouched: (): string[] => issued.map((entry) => entry.table),
    reset(): void {
      planned.clear()
      issued.length = 0
    },
  }
}

/** Which call of an operation happened first, so a test can prove one step preceded another. */
export function callOrder(query: FakeQuery | undefined, method: ChainMethod): number {
  return query?.[method].mock.invocationCallOrder[0] ?? Number.NaN
}
