import React, { useMemo } from 'react'

const SLOT_STYLES = {
  available: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 cursor-pointer',
  selected: 'bg-indigo-600 border-indigo-600 text-white',
  occupied: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer',
  past: 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed',
}

const localDateKey = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const localNowMinutes = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Re-apply past-slot blocking with the browser clock.
 * Production API hosts are often UTC; users schedule in local (India) time.
 */
const buildClientTimeline = (baseTimeline, selectedStartMinutes, durationMinutes, date) => {
  if (!baseTimeline?.slots?.length) return baseTimeline

  const selectedEndMinutes =
    selectedStartMinutes != null && durationMinutes
      ? selectedStartMinutes + Number(durationMinutes)
      : null

  const dayKey = date ? String(date).slice(0, 10) : (baseTimeline.businessDate || '')
  const isToday = Boolean(dayKey) && dayKey === localDateKey()
  const nowMinutes = localNowMinutes()

  const slots = baseTimeline.slots.map((slot) => {
    let status = slot.status
    // Disable past + currently running slot; only future starts are selectable.
    if (isToday && slot.startMinutes <= nowMinutes) {
      status = 'past'
    }
    if (
      selectedStartMinutes != null &&
      selectedEndMinutes != null &&
      slot.startMinutes < selectedEndMinutes &&
      slot.endMinutes > selectedStartMinutes
    ) {
      if (status !== 'past') status = 'selected'
    }
    return { ...slot, status, disabled: status === 'past' }
  })

  return { ...baseTimeline, slots }
}

const WorkingHoursTimelinePicker = ({
  timeline,
  selectedStartMinutes,
  durationMinutes,
  onSelectSlot,
  disabled = false,
  date,
}) => {
  const view = useMemo(
    () => buildClientTimeline(timeline, selectedStartMinutes, durationMinutes, date),
    [timeline, selectedStartMinutes, durationMinutes, date]
  )

  if (!view?.slots?.length) {
    return (
      <p className='text-xs text-gray-500'>Working hours not configured for this employee.</p>
    )
  }

  return (
    <div className='rounded-lg border border-gray-200 bg-white p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2 mb-3'>
        <div>
          <p className='text-sm font-semibold text-gray-900'>Working timeline</p>
          <p className='text-xs text-gray-500'>{view.workingHoursLabel}</p>
        </div>
        <p className='text-xs font-medium text-indigo-700'>
          Remaining: {view.remainingTimeLabel || '—'}
        </p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2'>
        {view.slots.map((slot) => (
          <button
            key={slot.startMinutes}
            type='button'
            disabled={disabled || slot.disabled}
            onClick={() => !slot.disabled && onSelectSlot?.(slot.startMinutes)}
            className={`relative rounded-md border px-2 py-2 text-xs font-medium transition-colors ${SLOT_STYLES[slot.status] || SLOT_STYLES.available}`}
            title={
              slot.status === 'past'
                ? 'Time has passed'
                : slot.taskCount > 0
                  ? `${slot.taskCount} task${slot.taskCount === 1 ? '' : 's'} scheduled — click to add another`
                  : 'Select start time'
            }
          >
            {slot.label}
            {slot.taskCount > 0 && slot.status !== 'past' && (
              <span
                className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                  slot.status === 'selected'
                    ? 'bg-white text-indigo-700 border-indigo-300'
                    : 'bg-amber-500 text-white border-amber-600'
                }`}
              >
                {slot.taskCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className='mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500'>
        <span className='inline-flex items-center gap-1'><span className='w-3 h-3 rounded bg-emerald-50 border border-emerald-200' /> Available</span>
        <span className='inline-flex items-center gap-1'><span className='w-3 h-3 rounded bg-indigo-600' /> Selected</span>
        <span className='inline-flex items-center gap-1'><span className='w-3 h-3 rounded bg-amber-50 border border-amber-200' /> Has tasks (count shown)</span>
        <span className='inline-flex items-center gap-1'><span className='w-3 h-3 rounded bg-gray-100 border border-gray-200' /> Passed</span>
      </div>

      {selectedStartMinutes != null && durationMinutes ? (
        <p className='mt-2 text-xs text-gray-600'>
          Scheduled: <span className='font-semibold text-gray-900'>
            {view.slots.find((s) => s.startMinutes === selectedStartMinutes)?.label || '—'}
          </span>
          {' · '}
          Duration: <span className='font-semibold text-gray-900'>{durationMinutes} min</span>
        </p>
      ) : (
        <p className='mt-2 text-xs text-gray-500'>
          Select a slot for 15 minutes. Click another slot to extend the selected duration.
        </p>
      )}
    </div>
  )
}

export default WorkingHoursTimelinePicker
