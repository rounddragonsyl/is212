import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReviewActions } from '../components/ReviewActions'
import { REVIEW_MESSAGES } from '../eventReviewService'

const mocks = vi.hoisted(() => ({ transition: vi.fn() }))

// The component is the unit; the real statusRules decide which buttons appear, and only the
// service call is stubbed. REVIEW_MESSAGES stays real so the error text is the shipped text.
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  transitionEventStatus: mocks.transition,
}))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'
const coordinator = { role: 'coordinator', isOwner: false }

beforeEach(() => {
  mocks.transition.mockReset()
})

describe('AC-004.2 — accept or reject via a button', () => {
  test('AC-004.2.22: a submitted request offers Start review, not an immediate decision', () => {
    render(<ReviewActions eventId={EVENT_ID} status="submitted" onReviewed={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })

  test('AC-004.2.23: a request under review offers Approve, Reject and Return buttons', () => {
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={vi.fn()} />)

    for (const name of ['Approve', 'Reject', 'Return for more detail']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
  })

  test('AC-004.2.24: Approve records the decision as the coordinator and reports the new status', async () => {
    mocks.transition.mockResolvedValue({ ok: true, status: 'approved' })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={onReviewed} />)

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(mocks.transition).toHaveBeenCalledWith({
      id: EVENT_ID, from: 'under_review', to: 'approved', actor: coordinator, note: '',
    })
    expect(onReviewed).toHaveBeenCalledWith('approved')
  })

  test('AC-004.2.25: a decided request offers no further review buttons', () => {
    render(<ReviewActions eventId={EVENT_ID} status="rejected" onReviewed={vi.fn()} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/final state/)).toBeInTheDocument()
  })

  test('AC-004.2.26: a failed decision reports an error and leaves the buttons usable for a retry', async () => {
    mocks.transition.mockRejectedValueOnce(new Error('network'))
    const onReviewed = vi.fn()
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={onReviewed} />)

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please try again')
    expect(onReviewed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
  })
})

describe('AC-004.3 — reasons entered through an input box', () => {
  test('AC-004.3.3: the reason typed in the box is sent with a rejection', async () => {
    mocks.transition.mockResolvedValue({ ok: true, status: 'rejected' })
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Note to the organiser'), 'The hall is closed that week.')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'rejected', note: 'The hall is closed that week.' }),
    )
  })

  test('AC-004.3.4: a rejection refused for having no reason explains why and does not complete', async () => {
    mocks.transition.mockResolvedValue({ ok: false, reason: REVIEW_MESSAGES.noteRequired })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={onReviewed} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(screen.getByRole('alert')).toHaveTextContent(REVIEW_MESSAGES.noteRequired)
    expect(onReviewed).not.toHaveBeenCalled()
  })

  test('AC-004.3.5: the reason box clears after a successful decision', async () => {
    mocks.transition.mockResolvedValue({ ok: true, status: 'submitted' })
    render(<ReviewActions eventId={EVENT_ID} status="under_review" onReviewed={vi.fn()} />)
    const box = screen.getByLabelText('Note to the organiser')

    await userEvent.type(box, 'Please add a programme.')
    await userEvent.click(screen.getByRole('button', { name: 'Return for more detail' }))

    expect(box).toHaveValue('')
  })
})
