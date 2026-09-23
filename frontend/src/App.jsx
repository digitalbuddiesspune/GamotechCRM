import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import RoleGuard from './components/RoleGuard'
import LocationPromptModal from './components/LocationPromptModal'
import { Outlet, useLocation } from 'react-router-dom'

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className='flex h-screen bg-gray-50'>
      <LocationPromptModal />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      <main className='flex-1 overflow-auto min-w-0 w-full'>
        <RoleGuard>
          <Outlet key={location.pathname} />
        </RoleGuard>
      </main>
    </div>
  )
}

export default App