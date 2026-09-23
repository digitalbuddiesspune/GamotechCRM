import React, { useMemo, useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  STATUS_COLORS,
  STATUS_OPTIONS,
  formatINR,
  formatDeadline,
  getDeadlineClass,
  getProjectCode,
  getClientName,
  getTeamList,
  getProjectStats,
  getStatusChartData,
  getUpcomingDeadlines,
  getTopClients,
  exportProjectsCsv,
} from './projectUtils'

const KpiCard = ({ title, value, subtitle, icon, iconBg, trend }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500 font-medium'>{title}</p>
        <p className='text-3xl font-bold text-gray-900 mt-1'>{value}</p>
        {subtitle && <p className='text-xs text-gray-500 mt-1'>{subtitle}</p>}
        {trend != null && (
          <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}% this month
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const TeamAvatars = ({ project }) => {
  const team = getTeamList(project).slice(0, 4)
  if (!team.length) return <span className='text-xs text-gray-400'>—</span>
  return (
    <div className='flex -space-x-2'>
      {team.map((m, i) => (
        <div
          key={m._id || i}
          title={m.name}
          className='w-8 h-8 rounded-full border-2 border-white bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0'
        >
          {(m.name || '?').charAt(0).toUpperCase()}
        </div>
      ))}
      {getTeamList(project).length > 4 && (
        <div className='w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold'>
          +{getTeamList(project).length - 4}
        </div>
      )}
    </div>
  )
}

const RowActions = ({ project, onDashboard, onEdit, onDelete, onAssign, canEdit, canAssign }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className='relative' onClick={(e) => e.stopPropagation()}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='p-2 rounded-lg hover:bg-gray-100 text-gray-500'
        aria-label='Actions'
      >
        ⋮
      </button>
      {open && (
        <>
          <button type='button' className='fixed inset-0 z-10' onClick={() => setOpen(false)} aria-label='Close menu' />
          <div className='absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm'>
            <button type='button' onClick={() => { setOpen(false); onDashboard(project) }} className='w-full text-left px-3 py-2 hover:bg-gray-50'>Dashboard</button>
            {canAssign && (
              <button type='button' onClick={() => { setOpen(false); onAssign(project) }} className='w-full text-left px-3 py-2 hover:bg-gray-50'>Assign Task</button>
            )}
            {canEdit && (
              <>
                <button type='button' onClick={() => { setOpen(false); onEdit(project) }} className='w-full text-left px-3 py-2 hover:bg-gray-50'>Edit</button>
                <button type='button' onClick={() => { setOpen(false); onDelete(project) }} className='w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600'>Delete</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const ProjectsDashboardLayout = ({
  title = 'Projects',
  subtitle = 'Track and manage all your projects in one place.',
  projects,
  loading,
  error,
  canAddProject,
  canAssignTask,
  canEditProject,
  onAddProject,
  onOpenProject,
  onEditProject,
  onDeleteProject,
  onDashboard,
  onAssignTask,
  itemsPerPage = 8,
  showExport = true,
  focusId = '',
}) => {
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterClient, setFilterClient] = useState('All')
  const [filterSearch, setFilterSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const stats = useMemo(() => getProjectStats(projects), [projects])
  const chartData = useMemo(() => getStatusChartData(projects), [projects])
  const upcoming = useMemo(() => getUpcomingDeadlines(projects), [projects])
  const topClients = useMemo(() => getTopClients(projects), [projects])

  const clientOptions = useMemo(() => {
    const map = new Map()
    projects.forEach((p) => {
      const id = p.client?._id || p.client
      const name = getClientName(p)
      if (id && name !== '—') map.set(String(id), name)
    })
    return [{ id: 'All', name: 'All Clients' }, ...[...map.entries()].map(([id, name]) => ({ id, name }))]
  }, [projects])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const isFocused = focusId && String(p._id) === focusId
      if (!isFocused) {
        if (filterStatus !== 'All' && p.status !== filterStatus) return false
        if (filterClient !== 'All') {
          const cid = p.client?._id || p.client
          if (String(cid) !== filterClient) return false
        }
        if (filterSearch.trim()) {
          const q = filterSearch.toLowerCase().trim()
          const hay = [p.projectName, getClientName(p), p.projectManager?.name].join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
      }
      return true
    })
  }, [projects, focusId, filterStatus, filterClient, filterSearch])

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterClient, filterSearch])

  useEffect(() => {
    if (!focusId) return
    const idx = filteredProjects.findIndex((p) => String(p._id) === focusId)
    if (idx < 0) return
    const page = Math.floor(idx / itemsPerPage) + 1
    setCurrentPage((prev) => (prev === page ? prev : page))
  }, [focusId, filteredProjects, itemsPerPage])

  useEffect(() => {
    if (!focusId) return
    const t = window.setTimeout(() => {
      document.getElementById(`project-focus-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [focusId, currentPage, filteredProjects.length])

  const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading projects...</div>
  }

  if (error) {
    return <div className='p-8 text-sm text-red-600'>{error}</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>{title}</h1>
          <p className='text-gray-600 mt-1 text-sm'>{subtitle}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {showExport && (
            <button
              type='button'
              onClick={() => exportProjectsCsv(filteredProjects)}
              className='px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50'
            >
              Export
            </button>
          )}
          {canAddProject && (
            <button
              type='button'
              onClick={onAddProject}
              className='px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700'
            >
              + New Project
            </button>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6'>
        <KpiCard title='Total Projects' value={stats.total} icon='📁' iconBg='bg-blue-50' trend={stats.growth} />
        <KpiCard title='In Progress' value={stats.inProgress} subtitle={`${stats.pct(stats.inProgress)}% of total`} icon='⏱️' iconBg='bg-orange-50' />
        <KpiCard title='Completed' value={stats.completed} subtitle={`${stats.pct(stats.completed)}% of total`} icon='✅' iconBg='bg-green-50' />
        <KpiCard title='On Hold' value={stats.onHold} subtitle={`${stats.pct(stats.onHold)}% of total`} icon='⏸️' iconBg='bg-red-50' />
        <KpiCard title='Cancelled' value={stats.cancelled} subtitle={`${stats.pct(stats.cancelled)}% of total`} icon='✕' iconBg='bg-gray-100' />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
        <div className='xl:col-span-2'>
          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3'>
              <h2 className='text-sm font-semibold text-gray-900'>Project List</h2>
              <div className='flex flex-wrap items-center gap-2'>
                <input
                  type='text'
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setCurrentPage(1) }}
                  placeholder='Search projects...'
                  className='border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}
                  className='border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === 'All' ? 'All Status' : s}</option>
                  ))}
                </select>
                <select
                  value={filterClient}
                  onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1) }}
                  className='border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className='overflow-x-auto'>
              <table className='w-full text-sm min-w-[900px]'>
                <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                  <tr>
                    <th className='px-4 py-3'>Project</th>
                    <th className='px-4 py-3'>Client</th>
                    <th className='px-4 py-3'>Status</th>
                    <th className='px-4 py-3'>Progress</th>
                    <th className='px-4 py-3'>Team</th>
                    <th className='px-4 py-3'>Deadline</th>
                    <th className='px-4 py-3'>Budget</th>
                    <th className='px-4 py-3 w-10' />
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100'>
                  {paginatedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className='px-4 py-12 text-center text-gray-500'>
                        {projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
                      </td>
                    </tr>
                  ) : (
                    paginatedProjects.map((project, idx) => {
                      const progress = project.progress ?? 0
                      const deadline = project.deadline || project.endDate
                      const statusStyle = STATUS_COLORS[project.status] || STATUS_COLORS['Not Started']
                      return (
                        <tr
                          key={project._id}
                          id={`project-focus-${project._id}`}
                          onClick={() => onOpenProject(project)}
                          className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${
                            focusId && String(project._id) === focusId ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-3'>
                              <div className='w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0'>
                                {(project.projectName || 'P').charAt(0).toUpperCase()}
                              </div>
                              <div className='min-w-0'>
                                <p className='font-semibold text-gray-900 truncate'>{project.projectName}</p>
                                <p className='text-xs text-gray-400'>{getProjectCode(project, startIndex + idx)}</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-4 py-3 text-gray-700'>{getClientName(project)}</td>
                          <td className='px-4 py-3'>
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.badge}`}>
                              {project.status}
                            </span>
                          </td>
                          <td className='px-4 py-3 min-w-[120px]'>
                            <div className='flex items-center gap-2'>
                              <div className='flex-1 h-2 bg-gray-100 rounded-full overflow-hidden'>
                                <div className='h-full bg-blue-500 rounded-full' style={{ width: `${progress}%` }} />
                              </div>
                              <span className='text-xs font-medium text-gray-600 w-8'>{progress}%</span>
                            </div>
                          </td>
                          <td className='px-4 py-3'><TeamAvatars project={project} /></td>
                          <td className={`px-4 py-3 text-sm ${getDeadlineClass(deadline, project.status)}`}>
                            {formatDeadline(deadline)}
                          </td>
                          <td className='px-4 py-3 text-gray-700 tabular-nums'>{formatINR(project.budget)}</td>
                          <td className='px-4 py-3'>
                            <RowActions
                              project={project}
                              onDashboard={onDashboard}
                              onEdit={onEditProject}
                              onDelete={onDeleteProject}
                              onAssign={onAssignTask}
                              canEdit={canEditProject}
                              canAssign={canAssignTask}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredProjects.length > 0 && (
              <div className='px-5 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs text-gray-500'>
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProjects.length)} of {filteredProjects.length} projects
                </p>
                {totalPages > 1 && (
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className='px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-50 hover:bg-gray-50'
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type='button'
                        onClick={() => handlePageChange(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium ${
                          currentPage === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type='button'
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className='px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-50 hover:bg-gray-50'
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className='space-y-6'>
          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
            <h3 className='text-sm font-semibold text-gray-900 mb-4'>Projects by Status</h3>
            {chartData.length ? (
              <div className='flex items-center gap-4'>
                <div className='h-40 w-40 shrink-0'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie data={chartData} dataKey='value' cx='50%' cy='50%' innerRadius={42} outerRadius={62} paddingAngle={2}>
                        {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className='flex-1 space-y-2'>
                  {chartData.map((d) => (
                    <div key={d.name} className='flex items-center justify-between text-xs'>
                      <span className='flex items-center gap-2'>
                        <span className='w-2.5 h-2.5 rounded-full' style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className='font-semibold text-gray-700'>
                        {d.value}
                        <span className='text-gray-400 font-normal ml-1'>
                          ({stats.total ? Math.round((d.value / stats.total) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className='text-sm text-gray-500 text-center py-8'>No project data</p>
            )}
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
              <h3 className='text-sm font-semibold text-gray-900'>Upcoming Deadlines</h3>
            </div>
            <div className='p-4 space-y-3'>
              {upcoming.length ? upcoming.map((p) => (
                <button
                  key={p._id}
                  type='button'
                  onClick={() => onOpenProject(p)}
                  className='w-full flex items-start gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -mx-2'
                >
                  <span className='text-lg'>📅</span>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 truncate'>{p.projectName}</p>
                    <p className='text-xs text-gray-500 truncate'>{getClientName(p)}</p>
                  </div>
                  <span className={`text-xs shrink-0 ${getDeadlineClass(p.deadline || p.endDate, p.status)}`}>
                    {formatDeadline(p.deadline || p.endDate)}
                  </span>
                </button>
              )) : (
                <p className='text-sm text-gray-500 text-center py-4'>No upcoming deadlines</p>
              )}
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
              <h3 className='text-sm font-semibold text-gray-900'>Top Clients</h3>
            </div>
            <div className='p-4 space-y-3'>
              {topClients.length ? topClients.map((c) => (
                <div key={c.id} className='flex items-center gap-3'>
                  <div className='w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0'>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 truncate'>{c.name}</p>
                  </div>
                  <span className='text-xs font-semibold text-gray-500'>{c.count} projects</span>
                </div>
              )) : (
                <p className='text-sm text-gray-500 text-center py-4'>No client data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectsDashboardLayout
