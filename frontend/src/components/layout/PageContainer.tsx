import type { ReactNode } from 'react'

/**
 * The standard page width. Applied per page rather than by AppShell, so a page that wants
 * full-bleed sections — the landing page and its dark hero — can opt out simply by not
 * using it, instead of fighting a container with negative margins.
 */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">{children}</div>
}
