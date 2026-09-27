/** The wordmark, kept in one place so every future page shows the same brand. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br
          from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm"
      >
        CS
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900">
        ConnectSphere
      </span>
    </span>
  )
}
