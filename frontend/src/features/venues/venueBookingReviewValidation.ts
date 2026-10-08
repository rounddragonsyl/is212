/** Kept pure so the form and service use the same required-reason rule. */
export function rejectionReasonError(reason: string): string | null {
  return reason.trim() ? null : 'Enter a rejection reason.'
}
