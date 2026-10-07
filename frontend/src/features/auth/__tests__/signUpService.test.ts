import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signUp } from '../authService'

const mocks = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { signUp: mocks.signUp } } }))

const input = { fullName: 'Ada Tan', email: 'ada@example.test', password: 'secret1' }
const duplicateMessage = 'An account with this email already exists. Sign in instead.'

// The shapes Supabase Auth returns. With "Confirm email" on, a new account has a user with one
// identity and no session; an existing email gets a user with no identities and no error.
const newUser = { id: 'user-1', identities: [{ id: 'identity-1' }] }
const session = { access_token: 'token', user: newUser }
const created = (withSession: boolean) => ({
  data: { user: newUser, session: withSession ? session : null },
  error: null,
})

/** What the browser actually sent to Supabase Auth. */
const sentPayload = () => mocks.signUp.mock.calls[0][0] as {
  email: string
  password: string
  options?: { data?: Record<string, unknown>; emailRedirectTo?: string }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.signUp.mockResolvedValue(created(false))
})

describe('AC-029.1: sign up with a name, email and password', () => {
  test('AC-029.1.13: sends the name with the sign-up and never a role', async () => {
    await signUp(input)

    const payload = sentPayload()
    expect(payload.email).toBe('ada@example.test')
    expect(payload.password).toBe('secret1')
    expect(payload.options?.data).toEqual({ full_name: 'Ada Tan' })
    expect(JSON.stringify(payload)).not.toMatch(/"role"/)
  })

  test('AC-029.1.14: a Supabase error is returned as the reason', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password is too weak', code: 'weak_password' },
    })

    await expect(signUp(input)).resolves.toMatchObject({ ok: false, reason: 'Password is too weak' })
  })
})

describe('AC-029.2: an email that already has an account cannot sign up again', () => {
  test('AC-029.2.1: a duplicate hidden by email confirmation (no identities) is reported', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'obfuscated', identities: [] }, session: null },
      error: null,
    })

    await expect(signUp(input)).resolves.toMatchObject({ ok: false, reason: duplicateMessage })
  })

  test('AC-029.2.2: a duplicate reported as an error gets the same message', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    })

    await expect(signUp(input)).resolves.toMatchObject({ ok: false, reason: duplicateMessage })
  })

  test('AC-029.2.3: a new email with one identity is not a duplicate (boundary)', async () => {
    await expect(signUp(input)).resolves.toMatchObject({ ok: true })
  })
})

describe('AC-029.3: self sign-up never grants an internal or organiser role', () => {
  test('AC-029.3.14: asks for organiser access only when requested, and still sends no role', async () => {
    await signUp({ ...input, requestOrganiser: true })
    expect(sentPayload().options?.data).toEqual({ full_name: 'Ada Tan', requested_role: 'organiser' })

    mocks.signUp.mockClear()
    await signUp({ ...input, requestOrganiser: false })
    expect(sentPayload().options?.data).not.toHaveProperty('requested_role')
  })
})

describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  test('AC-029.4.1: the confirmation link opens the events-open-for-registration page', async () => {
    await signUp(input)
    expect(sentPayload().options?.emailRedirectTo).toBe(`${window.location.origin}/events/open`)
  })

  test('AC-029.4.2: reports whether the new user already has a session', async () => {
    await expect(signUp(input)).resolves.toEqual({ ok: true, signedIn: false })

    mocks.signUp.mockResolvedValue(created(true))
    await expect(signUp(input)).resolves.toEqual({ ok: true, signedIn: true })
  })
})
