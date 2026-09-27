const STEPS = [
  {
    title: 'Describe your event',
    detail:
      'Purpose, dates, how many people, and anything you need in the room. It takes a couple of minutes.',
    role: 'You',
  },
  {
    title: 'A coordinator reviews it',
    detail:
      'Someone checks the details and comes back to you if anything needs clarifying before approving.',
    role: 'Event coordinator',
  },
  {
    title: 'Venue and equipment are held',
    detail:
      'Your room is booked and the technical team is briefed on what you asked for.',
    role: 'Venue & technical staff',
  },
  {
    title: 'Your event is confirmed',
    detail: 'Everything is in place, and you have a reference to quote if anything changes.',
    role: 'You',
  },
] as const

export function LandingWorkflow() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            From request to confirmed
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Four steps, and you can see which one you are on at any point.
          </p>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-white p-7">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full bg-slate-900
                    text-xs font-semibold text-white"
                >
                  {index + 1}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-600">
                  {step.role}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
