import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EventRequestForm } from '../components/EventRequestForm'
import type { SubmitEventRequestResult } from '../types'

const mocks = vi.hoisted(() => ({ submitEventRequest: vi.fn() }))

// The form is presentational; persistence belongs to the service, so the service is what
// we stub. No Supabase client is involved in a component test.
vi.mock('../eventService', () => ({ submitEventRequest: mocks.submitEventRequest }))

const success: SubmitEventRequestResult = {
  ok: true,
  event: {
    id: 'c0ffee00-0000-4000-8000-000000000001',
    reference: 'EVT-2026-0042',
    status: 'submitted',
    submittedAt: '2026-01-05T02:11:00.000Z',
  },
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/purpose of the event/i), {
    target: { value: 'Annual client appreciation dinner' },
  })
  fireEvent.change(screen.getByLabelText(/preferred start/i), {
    target: { value: '2099-06-01T18:00' },
  })
  fireEvent.change(screen.getByLabelText(/preferred end/i), {
    target: { value: '2099-06-01T22:00' },
  })
  fireEvent.change(screen.getByLabelText(/expected number of attendees/i), {
    target: { value: '120' },
  })
}

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /submit event request/i }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EventRequestForm', () => {
  test('AC-005.1: offers an input for every piece of preliminary information', () => {
    render(<EventRequestForm />)

    for (const label of [
      /purpose of the event/i,
      /type of event/i,
      /preferred start/i,
      /preferred end/i,
      /expected number of attendees/i,
      /general programme/i,
      /room layout preference/i,
      /accessibility requirements/i,
      /equipment requirements/i,
      /attendees must register/i,
      /other special arrangements/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  test('AC-005.2: does not submit when a required field is missing, and says which', async () => {
    render(<EventRequestForm />)

    submit()

    expect(await screen.findByText(/purpose is required/i)).toBeInTheDocument()
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
  })

  test('AC-005.3: informs the organiser of a successful submission and its reference', async () => {
    mocks.submitEventRequest.mockResolvedValue(success)
    render(<EventRequestForm />)

    fillRequiredFields()
    submit()

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Your event request was submitted')
    expect(banner).toHaveTextContent('EVT-2026-0042')
    expect(banner).toHaveTextContent('Submitted')
  })

  test('AC-005.4: informs the organiser of a failed submission with the reason', async () => {
    mocks.submitEventRequest.mockResolvedValue({
      ok: false,
      reason: 'You must be signed in as an event organiser to submit a request.',
      issues: [],
    } satisfies SubmitEventRequestResult)
    render(<EventRequestForm />)

    fillRequiredFields()
    submit()

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Your event request was not submitted')
    expect(banner).toHaveTextContent(/must be signed in as an event organiser/i)
  })

  test('AC-005.3: clears the form after a successful submission so the next request starts clean', async () => {
    mocks.submitEventRequest.mockResolvedValue(success)
    render(<EventRequestForm />)

    fillRequiredFields()
    submit()

    await screen.findByRole('status')
    await waitFor(() => {
      expect(screen.getByLabelText(/purpose of the event/i)).toHaveValue('')
    })
  })
})
