import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'

const fmtDate = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MilestonesModuleView = () => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        const res = await api.get('/projects')
        const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.projects || []
        if (!cancelled) setProjects(Array.isArray(list) ? list : [])
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load projects')
          setProjects([])
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

  const completedBeforeDeadline = useMemo(() => {
    return projects
      .filter((project) => project?.status === 'Completed' && project?.deadline)
      .filter((project) => {
        const deadline = new Date(project.deadline).getTime()
        const completedAt = new Date(project.endDate || project.updatedAt || project.createdAt).getTime()
        if (Number.isNaN(deadline) || Number.isNaN(completedAt)) return false
        return completedAt <= deadline
      })
      .sort((a, b) => {
        const dateA = new Date(a.endDate || a.updatedAt || a.createdAt).getTime()
        const dateB = new Date(b.endDate || b.updatedAt || b.createdAt).getTime()
        return dateB - dateA
      })
  }, [projects])

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading milestones…</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Milestones</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Projects completed before their deadline.
        </p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-5 py-4 border-b border-gray-100 flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-gray-900'>Completed before deadline</h2>
          <span className='text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full'>
            {completedBeforeDeadline.length} project{completedBeforeDeadline.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
              <tr>
                <th className='px-4 py-3'>Project</th>
                <th className='px-4 py-3'>Client</th>
                <th className='px-4 py-3'>Manager</th>
                <th className='px-4 py-3'>Completed</th>
                <th className='px-4 py-3'>Deadline</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {completedBeforeDeadline.length ? completedBeforeDeadline.map((project) => (
                <tr key={project._id}>
                  <td className='px-4 py-3'>
                    <p className='font-medium text-gray-900'>{project.projectName || '—'}</p>
                    <p className='text-xs text-gray-500'>{project.department || '—'}</p>
                  </td>
                  <td className='px-4 py-3 text-gray-700'>{project.client?.clientName || '—'}</td>
                  <td className='px-4 py-3 text-gray-700'>{project.projectManager?.name || '—'}</td>
                  <td className='px-4 py-3 text-gray-700'>{fmtDate(project.endDate || project.updatedAt)}</td>
                  <td className='px-4 py-3 text-green-700 font-medium'>{fmtDate(project.deadline)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className='px-4 py-12 text-center text-gray-500'>
                    No projects completed before deadline yet.
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

export default MilestonesModuleView
