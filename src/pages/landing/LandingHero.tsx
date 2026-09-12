import { Link } from 'react-router-dom'

/**
 * A dark hero under a light app: the contrast gives the landing page a distinct identity
 * without introducing a second colour system — the same indigo carries through.
 *
 * The preview is a real rendering of our own UI vocabulary, not a fabricated screenshot or
 * invented testimonial. Nothing on this page claims a customer, a logo or a number we do
 * not have.
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-slate-950">
      {/* Decorative only: a soft indigo bloom and a faint grid, both aria-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem]
          -translate-x-1/2 rounded-full bg-indigo-600/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.15]
          [background-image:linear-gradient(to_right,rgb(148_163_184/0.4)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.4)_1px,transparent_1px)]
          [background-size:64px_64px]
          [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-32">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/15
              bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Event planning, end to end
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Every event.
            <br />
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              One clear process.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Request a venue, agree the details, and watch your event move from idea to
            confirmed — without chasing anyone for an answer.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/signin"
              state={{ from: '/events/new' }}
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3
                text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-950/40 transition
                hover:bg-slate-100 focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Request a venue
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-6
                py-3 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  )
}

/** An illustrative render of a request as the app actually shows it. */
function HeroPreview() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
        <div className="rounded-xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-slate-400">EVT-2026-0184</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Annual Partner Summit
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Approved
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-xs">
            <div>
              <dt className="text-slate-400">Date</dt>
              <dd className="mt-0.5 font-medium text-slate-700">14 Mar, 18:00</dd>
            </div>
            <div>
              <dt className="text-slate-400">Attendance</dt>
              <dd className="mt-0.5 font-medium text-slate-700">240</dd>
            </div>
          </dl>

          <ol className="mt-5 space-y-3">
            {[
              { label: 'Submitted', done: true },
              { label: 'Under review', done: true },
              { label: 'Approved', done: true },
              { label: 'Venue confirmed', done: false },
            ].map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-xs">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    step.done ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white'
                  }`}
                >
                  {step.done ? '✓' : ''}
                </span>
                <span className={step.done ? 'text-slate-700' : 'text-slate-400'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
