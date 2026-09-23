import React, { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DetailRow = ({ label, children }) => (
  <div className='grid grid-cols-1 sm:grid-cols-3 gap-1 py-2.5 border-b border-gray-100 last:border-0'>
    <dt className='text-xs font-semibold text-gray-500 uppercase tracking-wide sm:pt-0.5'>{label}</dt>
    <dd className='text-sm text-gray-900 sm:col-span-2 break-words'>{children ?? '—'}</dd>
  </div>
)

function fmtDate(d) {
  if (d == null || d === '') return '—'
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString()
}

/**
 * Read-only project summary in a modal. Parent controls `project` (null = unmounted / don’t render overlay).
 */
export function ProjectDetailModal({ project, onClose }) {
  const navigate = useNavigate()
  const { canEditProject, canAssignTask } = useAuth()

  const close = useCallback(() => onClose?.(), [onClose])

  useEffect(() => {
    if (!project) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, close])

  if (!project) return null

  const team = Array.isArray(project.teamMembers) ? project.teamMembers : []
  const services = Array.isArray(project.services) ? project.services : []

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50'
      role='presentation'
      onClick={close}
    >
      <div
        className='bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200'
        role='dialog'
        aria-modal='true'
        aria-labelledby='project-detail-title'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50'>
          <div className='min-w-0'>
            <h2 id='project-detail-title' className='text-lg font-bold text-gray-900 truncate'>
              {project.projectName || 'Project'}
            </h2>
            <p className='text-sm text-gray-600 mt-0.5'>Read-only summary</p>
          </div>
          <button
            type='button'
            onClick={close}
            className='shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
            aria-label='Close'
          >
            <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>

        <div className='overflow-y-auto px-5 py-4'>
          <dl>
            <DetailRow label='Client'>{project.client?.clientName}</DetailRow>
            <DetailRow label='Department'>{project.department || 'IT'}</DetailRow>
            <DetailRow label='Project manager'>
              {project.projectManager?.name ? (
                <>
                  <span className='font-medium'>{project.projectManager.name}</span>
                  {project.projectManager?.email ? (
                    <span className='block text-xs text-gray-500 mt-0.5'>{project.projectManager.email}</span>
                  ) : null}
                </>
              ) : null}
            </DetailRow>
            <DetailRow label='Status'>{project.status}</DetailRow>
            <DetailRow label='Priority'>{project.priority}</DetailRow>
            <DetailRow label='Start date'>{fmtDate(project.startDate)}</DetailRow>
            <DetailRow label='End date'>{fmtDate(project.endDate)}</DetailRow>
            <DetailRow label='Due date'>{fmtDate(project.deadline)}</DetailRow>
            <DetailRow label='Budget'>
              {project.budget != null && project.budget !== ''
                ? `₹${Number(project.budget).toLocaleString('en-IN')}`
                : '—'}
            </DetailRow>
            <DetailRow label='Progress'>
              <div className='flex items-center gap-3'>
                <span>{project.progress ?? 0}%</span>
                <div className='flex-1 max-w-[200px] h-2 bg-gray-200 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-blue-500 rounded-full'
                    style={{ width: `${Math.min(100, Math.max(0, Number(project.progress) || 0))}%` }}
                  />
                </div>
              </div>
            </DetailRow>
            <DetailRow label='Description'>{project.description}</DetailRow>
            <DetailRow label='Notes'>{project.notes}</DetailRow>
          </dl>

          {team.length > 0 && (
            <div className='mt-4 pt-3 border-t border-gray-100'>
              <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Team members</p>
              <ul className='space-y-1 text-sm text-gray-800'>
                {team.map((m) => (
                  <li key={typeof m === 'object' ? m._id || m.name : m}>
                    {typeof m === 'object' ? (m.name || m.email || m._id) : String(m)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {services.length > 0 && (
            <div className='mt-4 pt-3 border-t border-gray-100'>
              <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Services</p>
              <ul className='flex flex-wrap gap-2'>
                {services.map((s) => (
                  <li key={s} className='px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-800'>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className='px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 justify-end'>
          {project._id ? (
            <button
              type='button'
              onClick={() => {
                navigate(`/projects/${project._id}/dashboard`)
                close()
              }}
              className='px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50'
            >
              Project dashboard
            </button>
          ) : null}
          {canAssignTask() && project._id ? (
            <button
              type='button'
              onClick={() => {
                navigate(`/assign-task?projectId=${project._id}`)
                close()
              }}
              className='px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50'
            >
              Assign task
            </button>
          ) : null}
          {canEditProject() && project._id ? (
            <button
              type='button'
              onClick={() => {
                navigate(`/projects/edit/${project._id}`)
                close()
              }}
              className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 text-gray-800'
            >
              Edit project
            </button>
          ) : null}
          <button
            type='button'
            onClick={close}
            className='px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
