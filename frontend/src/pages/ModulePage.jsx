import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MODULE_META } from '../config/moduleMeta'
import PerformanceModuleView from '../components/views/PerformanceModuleView'
import ChatPortalView from '../components/views/ChatPortalView'
import AssetsModuleView from '../components/views/AssetsModuleView'
import MilestonesModuleView from '../components/views/MilestonesModuleView'
import TimesheetsModuleView from '../components/views/TimesheetsModuleView'
import DepartmentsModuleView from '../components/views/DepartmentsModuleView'
import DesignationsModuleView from '../components/views/DesignationsModuleView'
import AnnouncementsModuleView from '../components/views/AnnouncementsModuleView'

const ModulePage = () => {
  const { slug } = useParams()
  const navigate = useNavigate()

  if (slug === 'performance') {
    return <PerformanceModuleView />
  }

  if (slug === 'chat') {
    return <ChatPortalView />
  }

  if (slug === 'assets') {
    return <AssetsModuleView />
  }

  if (slug === 'milestones') {
    return <MilestonesModuleView />
  }

  if (slug === 'timesheets') {
    return <TimesheetsModuleView />
  }

  if (slug === 'departments') {
    return <DepartmentsModuleView />
  }

  if (slug === 'designations') {
    return <DesignationsModuleView />
  }

  if (slug === 'announcements') {
    return <AnnouncementsModuleView />
  }

  const meta = MODULE_META[slug] || {
    title: slug?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Module',
    section: 'CRM',
    description: 'This module is being set up. Check back soon.',
  }

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-8'>
        <p className='text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2'>{meta.section}</p>
        <h1 className='text-2xl font-bold text-gray-900'>{meta.title}</h1>
        <p className='text-gray-600 mt-3 text-sm leading-relaxed'>{meta.description}</p>
        <div className='mt-8 p-4 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-900'>
          This page is a placeholder. Functionality for <strong>{meta.title}</strong> will be added in a future update.
        </div>
        <button type='button' onClick={() => navigate(-1)} className='inline-block mt-6 text-sm font-medium text-blue-600 hover:text-blue-700'>
          ← Go back
        </button>
      </div>
    </div>
  )
}

export default ModulePage
