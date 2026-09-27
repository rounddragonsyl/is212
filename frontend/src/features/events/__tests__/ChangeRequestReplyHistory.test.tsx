import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ChangeRequestSummary } from '../components/ChangeRequestSummary'
import { changeRequest, replyRound } from './fixtures/changeRequestReview'

test('AC-007.13.10: shared summary retains field and whole-request answers across multiple rounds', () => {
  render(<ChangeRequestSummary request={{ ...changeRequest, replyHistory: [replyRound, {
    ...replyRound, requestVersion: 3, fieldDecisions: null, reviewNote: 'Any further details?',
    reply: { note: 'No further changes.' },
  }] }} />)
  expect(screen.getByRole('region', { name: 'Clarification history' })).toBeInTheDocument()
  expect(screen.getByText('Includes staff?')).toBeInTheDocument()
  expect(screen.getByText('Yes, including ten staff.')).toBeInTheDocument()
  expect(screen.getByText('Any further details?')).toBeInTheDocument()
  expect(screen.getByText('No further changes.')).toBeInTheDocument()
})
test('AC-007.13.11: answered questions are shown as awaiting review rather than requiring another reply', () => {
  render(<ChangeRequestSummary request={{ ...changeRequest, fieldDecisions: replyRound.fieldDecisions, replyHistory: [replyRound] }} />)
  expect(screen.getByText('Reply received — awaiting review')).toBeInTheDocument()
  expect(screen.queryByText('Clarification required')).not.toBeInTheDocument()
})
