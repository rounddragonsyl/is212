import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegistrationForm } from '../components/RegistrationForm'

const mocks = vi.hoisted(() => ({ registerForEvent: vi.fn() }))

// The form is the unit here; the service is stubbed so no Supabase client is involved.
vi.mock('../registrationService', () => ({ registerForEvent: mocks.registerForEvent }))

function renderForm(hasPrerequisites = true) {
  render(
    <MemoryRouter>
      <RegistrationForm eventId="event-1" hasPrerequisites={hasPrerequisites} />
    </MemoryRouter>,
  )
}

const phoneField = () => screen.getByLabelText(/phone number/i)
const register = () => fireEvent.click(screen.getByRole('button', { name: /^register$/i }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.registerForEvent.mockResolvedValue({ ok: true })
})

describe('AC-015.2: the Attendee inputs the information required to register', () => {
  test('AC-015.2.9: filling in and submitting the form registers with the cleaned answers', async () => {
    renderForm()
    fireEvent.change(phoneField(), { target: { value: ' 9123 4567 ' } })
    fireEvent.change(screen.getByLabelText(/dietary requirements/i), { target: { value: 'Vegetarian' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /meet the prerequisites/i }))
    register()

    await waitFor(() => expect(mocks.registerForEvent).toHaveBeenCalledTimes(1))
    expect(mocks.registerForEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        phone: '9123 4567',
        dietaryRequirements: 'Vegetarian',
        accessibilityNeeds: null,
        prerequisitesConfirmed: true,
      }),
      { hasPrerequisites: true },
    )
  })

  test('AC-015.2.10: invalid answers show field errors and are not sent', async () => {
    renderForm()
    register()

    expect(await screen.findByText('Enter a phone number.')).toBeInTheDocument()
    expect(screen.getByText('Confirm that you meet the prerequisites.')).toBeInTheDocument()
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.registerForEvent).not.toHaveBeenCalled()
  })

  test('AC-015.2.11: a registration error is shown and the answers are kept', async () => {
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: 'Something went wrong' })
    renderForm(false)
    fireEvent.change(phoneField(), { target: { value: '91234567' } })
    register()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(phoneField()).toHaveValue('91234567')
    expect(screen.getByRole('button', { name: /^register$/i })).toBeEnabled()
  })
})

describe('AC-015.3: the Attendee receives an email confirmation', () => {
  test('AC-015.3.6: after registering, the page says a confirmation email is on its way', async () => {
    renderForm(false)
    fireEvent.change(phoneField(), { target: { value: '91234567' } })
    register()

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent("You're registered. A confirmation email is on its way.")
    expect(screen.getByRole('link', { name: /my registrations/i })).toHaveAttribute('href', '/registrations')
  })
})

describe('AC-015.5: an Attendee cannot register twice for the same event', () => {
  test('AC-015.5.7: two quick clicks send one registration', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    mocks.registerForEvent.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderForm(false)
    fireEvent.change(phoneField(), { target: { value: '91234567' } })

    const button = screen.getByRole('button', { name: /^register$/i })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByRole('button', { name: /registering/i })).toBeDisabled())
    expect(mocks.registerForEvent).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
