import type { ButtonHTMLAttributes } from 'react'

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5
        text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      {...props}
    >
      {children}
    </button>
  )
}
