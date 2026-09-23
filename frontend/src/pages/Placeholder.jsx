import React from 'react'

const Placeholder = ({ title }) => {
  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-gray-900'>{title}</h1>
      <p className='text-gray-600 mt-2'>This page is coming soon.</p>
    </div>
  )
}

export default Placeholder
