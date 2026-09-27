import type { ButtonHTMLAttributes } from 'react'

const baseClasses =
  'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm ' +
  'font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-300'

/**
 * className is merged rather than spread over the top: `{...props}` after a hardcoded
 * className would let a caller passing one silently strip every base style.
 */
export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${baseClasses} ${className}`} {...props}>
      {children}
    </button>
  )
}
