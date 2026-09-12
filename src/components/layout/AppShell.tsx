import type { ReactNode } from 'react'
import type { AppSession, UserProfile } from '../../features/auth/types'
import { TopNav } from './TopNav'

interface AppShellProps {
  session: AppSession | null
  profile: UserProfile | null
  loading: boolean
  children: ReactNode
}

/**
 * The frame every page sits in. Session and profile are passed down rather than read again
 * here, so the header and the page can never disagree about who is signed in.
 */
export function AppShell({ session, profile, loading, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Keyboard users can jump the navigation instead of tabbing through it on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20
          focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      <TopNav session={session} profile={profile} loading={loading} />

      {/* Unconstrained on purpose: pages apply PageContainer themselves, which lets the
          landing page run sections edge to edge. */}
      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-slate-500
            sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p>ConnectSphere — event planning and venue booking.</p>
          <p>Need help? Talk to your event coordinator.</p>
        </div>
      </footer>
    </div>
  )
}
