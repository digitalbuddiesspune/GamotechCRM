import React from 'react'
import DashboardView from './views/DashboardView'
import ClientsView from './views/ClientsView'
import CampaignsView from './views/CampaignsView'
import LeadsView from './views/LeadsView'
import ProjectsView from './views/ProjectsView'
import ReportsView from './views/ReportsView'
import TasksView from './views/TasksView'
import CalendarView from './views/CalendarView'

const Dashboard = ({ activeTab }) => {
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'clients':
        return <ClientsView />
      case 'campaigns':
        return <CampaignsView />
      case 'leads':
        return <LeadsView />
      case 'projects':
        return <ProjectsView />
      case 'reports':
        return <ReportsView />
      case 'tasks':
        return <TasksView />
      case 'calendar':
        return <CalendarView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className='bg-gray-50 min-h-screen'>
      {renderView()}
    </div>
  )
}

export default Dashboard
