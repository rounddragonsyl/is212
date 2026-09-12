import { Link } from 'react-router-dom'

export function LandingCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/2 h-80 w-80
              -translate-x-1/2 rounded-full bg-indigo-600/30 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Planning something?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
              Start with the date and the number of people. You can fill in the rest as the
              details firm up.
            </p>
            <Link
              to="/events/new"
              className="mt-9 inline-flex items-center justify-center rounded-lg bg-white px-7
                py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-white"
            >
              Request a venue
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
