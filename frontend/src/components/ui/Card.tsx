import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  children: ReactNode
}

/** A surface for a block of content. Shared so panels do not drift apart visually. */
export function Card({ title, description, children }: CardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      )}
      <div className="px-6 py-6">{children}</div>
    </section>
  )
}
