import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadEventSuitability } from '../suitabilityService'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

type Result = { data: unknown; error: { code?: string; message?: string } | null }

interface FakeQuery {
  calls: Record<string, unknown[][]>
  [method: string]: unknown
}

/** Stands in for a Supabase query: every builder method records its arguments and returns
 *  the query itself; awaiting it, or calling single/maybeSingle, gives the canned result. */
function query(result: Result): FakeQuery {
  const calls: Record<string, unknown[][]> = {}
  const builder: FakeQuery = {
    calls,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  for (const method of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'upsert']) {
    builder[method] = (...args: unknown[]) => {
      calls[method] = [...(calls[method] ?? []), args]
      return builder
    }
  }
  return builder
}

/** Sends supabase.from(table) to the canned query for that table. */
function tables(map: Record<string, FakeQuery>) {
  mocks.from.mockImplementation((table: string) => map[table])
}

const EVENT_ID = 'event-1'
const EVENT_ROW = {
  id: EVENT_ID,
  reference: 'EVT-1',
  name: 'Workshop',
  proposed_start: '2041-03-10T01:00:00Z', // 9am Singapore, so the AM slot
  proposed_end: '2041-03-10T03:00:00Z',
  expected_attendance: 60,
  layout_preference: 'Theatre style please',
  accessibility_requirements: 'Step-free access',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator-1' } }, error: null })
})

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test("AC-018.1.14: loads the event and the coordinator's saved requirements", async () => {
    tables({
      events: query({ data: EVENT_ROW, error: null }),
      event_venue_requirements: query({
        data: { layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'] },
        error: null,
      }),
    })
    expect(await loadEventSuitability(EVENT_ID)).toEqual({
      ok: true,
      value: {
        event: {
          id: EVENT_ID,
          reference: 'EVT-1',
          name: 'Workshop',
          proposedStart: '2041-03-10T01:00:00Z',
          proposedEnd: '2041-03-10T03:00:00Z',
          expectedAttendance: 60,
          layoutPreference: 'Theatre style please',
          accessibilityRequirements: 'Step-free access',
        },
        requirements: { layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'] },
      },
    })
  })
})