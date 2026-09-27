import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ChangeRequestSummary } from '../components/ChangeRequestSummary'
import { changeRequest } from './fixtures/changeRequestReview'

test('AC-007.11.11: shared request summary displays significance and the affected field', () => {
  render(<ChangeRequestSummary request={changeRequest} />)
  expect(screen.getByText('Significant change')).toBeInTheDocument()
  expect(screen.getByText('Affects: Expected attendance.')).toBeInTheDocument()
  expect(screen.getByText('In review')).toBeInTheDocument()
})
test('AC-007.11.12: a description-only request displays Ordinary edit without a significant-field explanation', () => {
  render(<ChangeRequestSummary request={{ ...changeRequest, proposedChanges: { description: 'Revised description' } }} />)
  expect(screen.getByText('Ordinary edit')).toBeInTheDocument()
  expect(screen.queryByText(/^Affects:/)).not.toBeInTheDocument()
})
test('AC-007.11.13: final review does not erase the original request classification or replace its outcome', () => {
  render(<ChangeRequestSummary request={{ ...changeRequest, status: 'rejected', fieldDecisions: [] }} />)
  expect(screen.getByText('Significant change')).toBeInTheDocument()
  expect(screen.getByText('Rejected')).toBeInTheDocument()
})
