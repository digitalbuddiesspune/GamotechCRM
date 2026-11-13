const STATUSES = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
]

const activeClass = (status) => {
  if (status === 'Interested') return 'bg-emerald-600 text-white border-emerald-600'
  if (status === 'Meeting Schedule') return 'bg-amber-500 text-white border-amber-500'
  if (status === 'Not Interested') return 'bg-gray-700 text-white border-gray-700'
  if (status === 'Call You After Sometime') return 'bg-violet-600 text-white border-violet-600'
  return 'bg-blue-600 text-white border-blue-600'
}

const StatusFilterChips = ({ value, onChange, counts }) => {
  const options = [{ label: 'All', value: '' }, ...STATUSES.map((status) => ({ label: status, value: status }))]

  return (
    <div className='flex flex-wrap gap-2' role='group' aria-label='Filter by status'>
      {options.map((option) => {
        const active = value === option.value
        const count = counts?.[option.value]
        return (
          <button
            key={option.label}
            type='button'
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? activeClass(option.value) : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {option.label}
            {count != null ? <span className='ml-1.5 tabular-nums opacity-80'>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export default StatusFilterChips
