import React from 'react'

const CalendarView = () => {
  const currentMonth = 'March 2026'
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1)
  const firstDayOfWeek = 2 // March 1, 2026 is a Sunday (0 = Sunday)

  const events = {
    1: [{ title: 'Q1 Planning Meeting', time: '10:00 AM', type: 'Meeting' }],
    5: [{ title: 'Client Presentation', time: '2:00 PM', type: 'Meeting' }, { title: 'Campaign Launch', time: '4:00 PM', type: 'Event' }],
    10: [{ title: 'Team Sync', time: '9:00 AM', type: 'Meeting' }],
    15: [{ title: 'Project Deadline', time: '5:00 PM', type: 'Deadline' }],
    20: [{ title: 'Board Meeting', time: '11:00 AM', type: 'Meeting' }],
    25: [{ title: 'Training Session', time: '3:00 PM', type: 'Training' }],
  }

  const getEventColor = (type) => {
    switch(type) {
      case 'Meeting': return 'bg-blue-100 text-blue-800'
      case 'Event': return 'bg-purple-100 text-purple-800'
      case 'Deadline': return 'bg-red-100 text-red-800'
      case 'Training': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className='p-8'>
      <div className='mb-8 flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Calendar</h1>
          <p className='text-gray-600 mt-2'>Team events and important dates.</p>
        </div>
        <button className='bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors'>
          + New Event
        </button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Calendar Grid */}
        <div className='lg:col-span-2 bg-white rounded-lg shadow-md p-6'>
          <div className='mb-6'>
            <h2 className='text-2xl font-bold text-gray-900'>{currentMonth}</h2>
          </div>

          {/* Day Headers */}
          <div className='grid grid-cols-7 gap-2 mb-4'>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className='text-center font-bold text-gray-600 py-2'>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className='grid grid-cols-7 gap-2'>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className='aspect-square'></div>
            ))}

            {/* Days of month */}
            {daysInMonth.map((day) => (
              <div
                key={day}
                className={`aspect-square border rounded-lg p-2 flex flex-col items-start justify-start text-sm ${
                  day === 1 ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 hover:border-cyan-300'
                }`}
              >
                <span className={`font-bold ${day === 1 ? 'text-cyan-600' : 'text-gray-900'}`}>
                  {day}
                </span>
                {events[day] && (
                  <div className='mt-1 space-y-1 w-full'>
                    {events[day].slice(0, 1).map((event, idx) => (
                      <div
                        key={idx}
                        className={`text-xs px-2 py-1 rounded truncate ${getEventColor(event.type)}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {events[day].length > 1 && (
                      <div className='text-xs px-2 py-1 rounded bg-gray-100 text-gray-800'>
                        +{events[day].length - 1} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h2 className='text-lg font-bold text-gray-900 mb-4'>Upcoming Events</h2>
          <div className='space-y-4'>
            {[
              { date: 'Mar 1', title: 'Q1 Planning Meeting', time: '10:00 AM', type: 'Meeting' },
              { date: 'Mar 5', title: 'Client Presentation', time: '2:00 PM', type: 'Meeting' },
              { date: 'Mar 5', title: 'Campaign Launch', time: '4:00 PM', type: 'Event' },
              { date: 'Mar 10', title: 'Team Sync', time: '9:00 AM', type: 'Meeting' },
              { date: 'Mar 15', title: 'Project Deadline', time: '5:00 PM', type: 'Deadline' },
              { date: 'Mar 20', title: 'Board Meeting', time: '11:00 AM', type: 'Meeting' },
            ].map((event, idx) => (
              <div key={idx} className='pb-4 border-b border-gray-100 last:border-0'>
                <div className='flex items-start gap-3'>
                  <div className={`text-xs font-bold px-2 py-1 rounded ${getEventColor(event.type)}`}>
                    {event.date}
                  </div>
                  <div className='flex-1'>
                    <p className='text-sm font-semibold text-gray-900'>{event.title}</p>
                    <p className='text-xs text-gray-600'>{event.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Legend */}
      <div className='mt-6 bg-white rounded-lg shadow-md p-6'>
        <h3 className='text-lg font-bold text-gray-900 mb-4'>Event Types</h3>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {[
            { type: 'Meeting', color: 'bg-blue-100 text-blue-800' },
            { type: 'Event', color: 'bg-purple-100 text-purple-800' },
            { type: 'Deadline', color: 'bg-red-100 text-red-800' },
            { type: 'Training', color: 'bg-green-100 text-green-800' },
          ].map((item) => (
            <div key={item.type} className='flex items-center gap-2'>
              <div className={`w-4 h-4 rounded ${item.color}`}></div>
              <span className='text-sm font-medium text-gray-700'>{item.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CalendarView
