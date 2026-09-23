import React, { useEffect, useMemo, useRef, useState } from 'react'

const baseInputClass =
  'mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed'

/**
 * Combobox: type to filter options; click to select.
 * Pass `options` as [{ value, label }]; empty selection uses `value` not present in options (placeholder shows when closed).
 */
export default function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options = [],
  disabled,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  inputClassName = baseInputClass,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value)
    return found?.label ?? value ?? ''
  }, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => (o.label || String(o.value)).toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const onDoc = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleFocus = () => {
    if (disabled) return
    setOpen(true)
    setQuery(selectedLabel)
  }

  const handleChange = (e) => {
    if (disabled) return
    setQuery(e.target.value)
    setOpen(true)
  }

  const handleSelect = (opt) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 180)
  }

  return (
    <div ref={containerRef} className='relative'>
      {label && (
        <label htmlFor={id} className='block text-sm font-medium text-gray-700'>
          {label}
        </label>
      )}
      <input
        id={id}
        type='text'
        autoComplete='off'
        disabled={disabled}
        placeholder={open ? searchPlaceholder : placeholder}
        value={open ? query : selectedLabel}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClassName}
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        role='combobox'
      />
      {open && !disabled && (
        <ul
          id={`${id}-listbox`}
          role='listbox'
          className='absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
        >
          {filtered.length === 0 ? (
            <li className='px-3 py-2 text-sm text-gray-500'>{emptyText}</li>
          ) : (
            filtered.map((opt) => (
              <li key={String(opt.value)}>
                <button
                  type='button'
                  role='option'
                  aria-selected={opt.value === value}
                  className='w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50'
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label ?? opt.value}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
