const STEPS = [
  {
    title: 'You submit',
    detail: 'Your request is stored with a unique reference and the status In review.',
  },
  {
    title: 'A coordinator reviews',
    detail: 'A coordinator checks the details and may ask you for clarification.',
  },
  {
    title: 'A venue is matched',
    detail: 'Once approved, venue and equipment are booked against your requirements.',
  },
] as const

/**
 * Uses organiser-facing status wording, so the page
 * never promises a workflow the system does not actually implement.
 */
export function SubmissionGuidance() {
  return (
    <aside className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">What happens next</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full
                  bg-indigo-50 text-xs font-semibold text-indigo-700"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-6">
        <h2 className="text-sm font-semibold text-indigo-900">Before you submit</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-indigo-900/80">
          <li>Purpose, preferred date and time, and expected attendance are required.</li>
          <li>Everything else can be refined with your coordinator later.</li>
          <li>The more you tell us about layout and equipment, the better the match.</li>
        </ul>
      </div>
    </aside>
  )
}
