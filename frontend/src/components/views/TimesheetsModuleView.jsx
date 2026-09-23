import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'

const minutesToLabel = (minutes) => {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) return '0h'
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h && rem) return `${h}h ${rem}m`
  if (h) return `${h}h`
  return `${rem}m`
}

const getTaskActualMinutes = (task) => {
  if (task?.status !== 'Completed') return 0
  const start = new Date(task.startedAt || task.createdAt).getTime()
  const end = new Date(task.completedAt || task.updatedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return Number(task.estimatedDurationMinutes) || 0
  }
  return Math.max(0, Math.round((end - start) / 60000))
}

const TimesheetsModuleView = () => {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        const [projectsRes, tasksRes] = await Promise.all([
          api.get('/projects'),
          api.get('/tasks'),
        ])
        const projectList = Array.isArray(projectsRes.data)
          ? projectsRes.data
          : projectsRes.data?.data || projectsRes.data?.projects || []
        const taskList = Array.isArray(tasksRes.data) ? tasksRes.data : []
        if (!cancelled) {
          setProjects(Array.isArray(projectList) ? projectList : [])
          setTasks(taskList.filter((t) => !String(t._id).startsWith('social-media-')))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load timesheets')
          setProjects([])
          setTasks([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const projectMap = new Map(projects.map((p) => [String(p._id), p]))
    const timesheetMap = new Map()

    tasks.forEach((task) => {
      const projectId = String(task?.project?._id || task?.project || '')
      if (!projectId) return
      if (!timesheetMap.has(projectId)) {
        timesheetMap.set(projectId, {
          projectId,
          totalTasks: 0,
          completedTasks: 0,
          openTasks: 0,
          estimatedMinutes: 0,
          actualMinutes: 0,
        })
      }
      const row = timesheetMap.get(projectId)
      row.totalTasks += 1
      const estimated = Number(task.estimatedDurationMinutes) || 0
      row.estimatedMinutes += Math.max(0, estimated)
      if (task.status === 'Completed') {
        row.completedTasks += 1
        row.actualMinutes += getTaskActualMinutes(task)
      } else {
        row.openTasks += 1
      }
    })

    return [...timesheetMap.values()]
      .map((row) => ({
        ...row,
        project: projectMap.get(row.projectId),
      }))
      .sort((a, b) => b.actualMinutes - a.actualMinutes)
  }, [projects, tasks])

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading timesheets…</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Project Timesheets</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Time summary by project based on task duration and completion.
        </p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-5 py-4 border-b border-gray-100'>
          <h2 className='text-sm font-semibold text-gray-900'>Project timesheet summary ({rows.length})</h2>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
              <tr>
                <th className='px-4 py-3'>Project</th>
                <th className='px-4 py-3'>Tasks</th>
                <th className='px-4 py-3'>Completed</th>
                <th className='px-4 py-3'>Open</th>
                <th className='px-4 py-3'>Estimated Time</th>
                <th className='px-4 py-3'>Actual Time</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {rows.length ? rows.map((row) => (
                <tr key={row.projectId}>
                  <td className='px-4 py-3'>
                    <p className='font-medium text-gray-900'>{row.project?.projectName || '—'}</p>
                    <p className='text-xs text-gray-500'>{row.project?.client?.clientName || '—'}</p>
                  </td>
                  <td className='px-4 py-3 text-gray-700'>{row.totalTasks}</td>
                  <td className='px-4 py-3 text-green-700 font-medium'>{row.completedTasks}</td>
                  <td className='px-4 py-3 text-amber-700 font-medium'>{row.openTasks}</td>
                  <td className='px-4 py-3 text-gray-700'>{minutesToLabel(row.estimatedMinutes)}</td>
                  <td className='px-4 py-3 text-indigo-700 font-medium'>{minutesToLabel(row.actualMinutes)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className='px-4 py-12 text-center text-gray-500'>
                    No project timesheet data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TimesheetsModuleView
