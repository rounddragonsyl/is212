import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../../../components/layout/BrandMark'

interface AuthPageShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/** The centred frame shared by sign-in and sign-up, so the two pages cannot drift apart. */
export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="flex justify-center">
        <BrandMark />
      </div>

      <h1 className="mt-8 text-center text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-sm text-slate-600">{subtitle}</p>}

      {children}

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-900 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  )
}
