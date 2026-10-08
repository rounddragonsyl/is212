import type { ReactNode } from 'react'

interface ErrorAlertProps {
  children: ReactNode
  /** Offers a Try again button, so a message that says "try again" also gives the means to. */
  onRetry?: () => void
}

/** A page- or form-level error, announced to screen readers as it appears. */
export function ErrorAlert({ children, onRetry }: ErrorAlertProps) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  )
}
