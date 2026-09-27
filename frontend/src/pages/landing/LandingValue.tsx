import type { ReactNode } from 'react'

const iconClasses = 'h-5 w-5'

/** Inline SVGs rather than an icon package: three icons is not worth a dependency. */
const ICONS: Record<string, ReactNode> = {
  form: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

const VALUES = [
  {
    icon: 'form',
    title: 'Ask once',
    detail:
      'One form captures the purpose, the timing, the room layout, accessibility and the equipment you need. No follow-up thread to fill in the gaps.',
  },
  {
    icon: 'status',
    title: 'Always know where it stands',
    detail:
      'Every request carries a reference and a status you can check at any time, so nobody has to ask whether it has been looked at.',
  },
  {
    icon: 'shield',
    title: 'No double bookings',
    detail:
      'Venue availability is enforced when the booking is made, not discovered on the day. A slot that is taken cannot be given away twice.',
  },
] as const

export function LandingValue() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Built around how events actually get planned
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Most of the work in planning an event is chasing information. This removes that
            part.
          </p>
        </div>

        <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value) => (
            <li key={value.title}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                {ICONS[value.icon]}
              </span>
              <h3 className="mt-5 text-base font-semibold text-slate-900">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
