interface AccountTypeChoiceProps {
  requestOrganiser: boolean
  onChange: (requestOrganiser: boolean) => void
}

const OPTIONS = [
  { value: false, label: 'Attendee', hint: 'Register for events' },
  { value: true, label: 'Organiser', hint: 'Needs approval' },
] as const

/**
 * The two ways to sign up, side by side. Real radio inputs underneath, so keyboard and screen
 * reader users get the standard behaviour. Choosing Organiser only asks for access: the
 * database still creates an Attendee (0042, AC-029.3).
 */
export function AccountTypeChoice({ requestOrganiser, onChange }: AccountTypeChoiceProps) {
  return (
    <fieldset>
      <legend className="sr-only">Account type</legend>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {OPTIONS.map((option) => {
          const selected = option.value === requestOrganiser
          return (
            <label
              key={option.label}
              className={
                'flex cursor-pointer flex-col items-center rounded-lg px-3 py-2 text-center ' +
                'transition focus-within:ring-2 focus-within:ring-indigo-500 ' +
                (selected ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')
              }
            >
              <input
                type="radio"
                name="accountType"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-slate-500">{option.hint}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
