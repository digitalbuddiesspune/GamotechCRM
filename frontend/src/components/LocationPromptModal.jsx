import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'crm_show_location_prompt'

const LocationPromptModal = () => {
  const [show, setShow] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
      setShow(true)
    }
  }, [])

  const close = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setShow(false)
  }

  const handleTurnOn = () => {
    if (!navigator.geolocation) {
      close()
      return
    }
    setRequesting(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false)
        close()
      },
      () => {
        setRequesting(false)
        close()
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
    )
  }

  if (!show) return null

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50' role='dialog' aria-modal='true' aria-labelledby='location-prompt-title'>
      <div className='bg-white rounded-2xl shadow-xl max-w-md w-full p-6'>
        <div className='flex justify-center mb-4'>
          <div className='w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center'>
            <svg className='w-7 h-7 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' />
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 11a3 3 0 11-6 0 3 3 0 016 0z' />
            </svg>
          </div>
        </div>
        <h2 id='location-prompt-title' className='text-xl font-semibold text-gray-900 text-center mb-2'>
          Turn on location
        </h2>
        <p className='text-gray-600 text-sm text-center mb-6'>
          Enable Google location (or device location) for a better experience—for example, for attendance and check-in.
        </p>
        <div className='flex flex-col sm:flex-row gap-3'>
          <button
            type='button'
            onClick={handleTurnOn}
            disabled={requesting}
            className='flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors'
          >
            {requesting ? 'Turning on…' : 'Turn on location'}
          </button>
          <button
            type='button'
            onClick={close}
            className='flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors'
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export default LocationPromptModal
