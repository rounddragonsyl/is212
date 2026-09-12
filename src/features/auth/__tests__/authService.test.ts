import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ensureOrganiserProfile } from '../authService'
import type { AppSession } from '../types'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from },
}))

const session: AppSession = {
  userId: '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11',
  email: 'organiser@example.com',
}

interface ProfileRow {
  id: string
}

function mockProfiles(options: {
  existing: ProfileRow | null
  selectError?: { message: string } | null
  insertError?: { message: string } | null
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.existing,
    error: options.selectError ?? null,
  })
  const eq = vi.fn((_column: string, _value: string) => ({ maybeSingle }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const insert = vi
    .fn((_row: Record<string, unknown>) => ({}))
    .mockResolvedValue({ error: options.insertError ?? null })

  mocks.from.mockReturnValue({ select, insert })
  return { select, insert }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Development scaffolding for US-005, not a story of its own — US-002 replaces it. Tested
// because a silent failure here surfaces later as an unexplained foreign-key error on
// submission, which is an expensive thing to debug.
describe('ensureOrganiserProfile', () => {
  test('creates a missing profile so events.organiser_id has something to reference', async () => {
    const { insert } = mockProfiles({ existing: null })

    const result = await ensureOrganiserProfile(session)

    expect(result.ok).toBe(true)
    expect(insert).toHaveBeenCalledWith({
      id: session.userId,
      full_name: 'organiser',
      role: 'organiser',
    })
  })

  test('leaves an existing profile alone rather than overwriting its role', async () => {
    const { insert } = mockProfiles({ existing: { id: session.userId } })

    const result = await ensureOrganiserProfile(session)

    expect(result.ok).toBe(true)
    expect(insert).not.toHaveBeenCalled()
  })

  test('reports why the profile could not be created', async () => {
    mockProfiles({ existing: null, insertError: { message: 'duplicate key value' } })

    const result = await ensureOrganiserProfile(session)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('duplicate key value')
  })

  test('reports a failed lookup instead of silently creating a second profile', async () => {
    const { insert } = mockProfiles({
      existing: null,
      selectError: { message: 'permission denied for table profiles' },
    })

    const result = await ensureOrganiserProfile(session)

    expect(result.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
})
