import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'

const controlClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition placeholder:text-slate-400 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  // An invalid control is outlined as well as described, so the error is visible
  // without reading — colour alone would fail an accessibility review.
  'aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/20 ' +
  'disabled:bg-slate-100'

interface FieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ id, label, required, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-600" aria-label="required">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {/* role="alert" so a screen reader announces the AC-005.2 failure, not just sighted users. */}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    return <input ref={ref} className={controlClasses} {...props} />
  },
)

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(props, ref) {
  return <textarea ref={ref} rows={3} className={controlClasses} {...props} />
})

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox(props, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        {...props}
      />
    )
  },
)
