import type { ReactNode } from 'react'

/** A page- or form-level error, announced to screen readers as it appears. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {children}
    </p>
  )
}
