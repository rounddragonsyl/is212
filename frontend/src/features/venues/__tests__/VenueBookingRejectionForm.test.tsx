import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBookingRejectionForm } from '../components/VenueBookingRejectionForm'

const mocks = vi.hoisted(() => ({ reject: vi.fn(), role: 'venue_staff' }))
vi.mock('../venueBookingReviewService', () => ({ rejectVenueBooking: mocks.reject }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { role: mocks.role } }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.reject.mockResolvedValue({ ok: true })
})

test('AC-010.8.15: the form requires a nonblank reason before rejection', async () => {
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), '   ')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a rejection reason.')
  expect(mocks.reject).not.toHaveBeenCalled()
})

test('AC-010.8.16: a valid rejection reports success and closes the action', async () => {
  const onRejected = vi.fn()
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={onRejected} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Venue unsuitable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(mocks.reject).toHaveBeenCalledWith('booking-1', 'Venue unsuitable')
  expect(await screen.findByRole('status')).toHaveTextContent('Booking rejected.')
  expect(onRejected).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})
