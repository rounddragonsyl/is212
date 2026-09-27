import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'

export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          We could not find that page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The link may be out of date, or the page may have moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5
            py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Back to home
        </Link>
      </div>
    </PageContainer>
  )
}
