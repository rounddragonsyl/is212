/** PURE MODULE — display formatting only. Kept out of components so it is testable. */

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date)
}

/** A dash rather than an empty cell, so a blank optional field reads as deliberate. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text.length > 0 ? text : '—'
}
