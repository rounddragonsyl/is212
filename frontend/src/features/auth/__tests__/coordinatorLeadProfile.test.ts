import { expect, test, vi } from 'vitest'
import { getMyProfile } from '../authService'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from },
}))

test('AC-017.1.1: recognises the signed-in Coordinator Lead profile', async () => {
  const userId = '17000000-0000-0000-0000-000000000001'
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: userId, full_name: 'Coordinator Lead', role: 'coordinator_lead' },
    error: null,
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })

  expect(await getMyProfile(userId)).toEqual({
    id: userId,
    fullName: 'Coordinator Lead',
    role: 'coordinator_lead',
  })
  expect(mocks.from).toHaveBeenCalledWith('profiles')
  expect(eq).toHaveBeenCalledWith('id', userId)
})
