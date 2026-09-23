import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { DashboardIcon, EditIcon } from '../Icons'

const thead = 'text-left border-b bg-blue-600 text-white font-bold text-sm'
const th = 'px-4 py-3 text-left border-b border-blue-700/30'

const fmtDate = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const fmtMoney = (n) => {
  if (n == null || n === '') return '—'
  const v = Number(n)
  return Number.isFinite(v) ? `₹${v.toLocaleString('en-IN')}` : '—'
}

const fmtDateTime = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  return Number.isNaN(x.getTime())
    ? '—'
    : x.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const DetailRow = ({ label, children }) => (
  <div className='grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2.5 border-b border-gray-100 last:border-0'>
    <dt className='text-xs font-semibold text-gray-500 uppercase tracking-wide sm:pt-0.5'>{label}</dt>
    <dd className='text-sm text-gray-900 sm:col-span-2 break-words'>{children ?? '—'}</dd>
  </div>
)

const ProjectDashboardView = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { canEditProject } = useAuth()
  const projectsListPath = location.pathname.startsWith('/my-projects') ? '/my-projects' : '/projects'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskDetail, setTaskDetail] = useState(null)
  const [taskDetailLoading, setTaskDetailLoading] = useState(false)
  const [taskDetailError, setTaskDetailError] = useState(null)

  const closeTaskModal = useCallback(() => {
    setTaskModalOpen(false)
    setTaskDetail(null)
    setTaskDetailError(null)
    setTaskDetailLoading(false)
  }, [])

  const openTaskModal = useCallback(async (taskId) => {
    if (!taskId) return
    setTaskModalOpen(true)
    setTaskDetailLoading(true)
    setTaskDetail(null)
    setTaskDetailError(null)
    try {
      const res = await api.get(`/tasks/${taskId}`)
      setTaskDetail(res.data)
    } catch (err) {
      setTaskDetailError(err.response?.data?.message || err.message || 'Could not load task')
    } finally {
      setTaskDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!taskModalOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeTaskModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [taskModalOpen, closeTaskModal])

  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      try {
        setLoading(true)
        setError(null)
        const res = await api.get(`/projects/${projectId}/dashboard`)
        setData(res.data)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) {
    return (
      <div className='p-8'>
        <p className='text-sm text-gray-600'>Loading project dashboard…</p>
      </div>
    )
  }

  if (error || !data?.project) {
    return (
      <div className='p-8'>
        <p className='text-red-600 text-sm'>{error || 'Project not found'}</p>
        <button type='button' onClick={() => navigate(projectsListPath)} className='mt-4 text-blue-600 text-sm font-medium'>
          Back
        </button>
      </div>
    )
  }

  const { project, client, financials = {}, billingSummary = {}, billings = [], tasks = [], workHistory = [] } = data
  const bs = billingSummary
  const f = financials

  return (
    <div className='p-8 w-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-8'>
        <div>
          <div className='flex items-center gap-2 text-gray-500 text-sm mb-1'>
            <DashboardIcon />
            <span>Project dashboard</span>
          </div>
          <h1 className='text-2xl font-bold text-gray-900'>{project.projectName}</h1>
          <p className='text-gray-600 text-sm mt-1'>
            Client, billing, tasks, and activity for this project.
            {client?.clientName ? ` · ${client.clientName}` : ''}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => navigate(projectsListPath)}
            className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'
          >
            {projectsListPath === '/my-projects' ? 'My projects' : 'All projects'}
          </button>
          {client?._id && (
            <button
              type='button'
              onClick={() => navigate(`/clients/${client._id}/dashboard`)}
              className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'
            >
              Client dashboard
            </button>
          )}
          {canEditProject() && (
            <button
              type='button'
              onClick={() => navigate(`/projects/edit/${projectId}`)}
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700'
            >
              <EditIcon />
              Edit project
            </button>
          )}
        </div>
      </div>

      {/* Client profile (same blocks as client dashboard) */}
      {client ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8'>
          <div className='bg-white rounded-lg shadow border border-gray-100 p-4'>
            <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'>Contact</h2>
            <dl className='space-y-2 text-sm'>
              <div><dt className='text-gray-500'>Email</dt><dd className='font-medium text-gray-900'>{client.mailId || '—'}</dd></div>
              <div><dt className='text-gray-500'>Phone</dt><dd className='font-medium text-gray-900'>{client.clientNumber || '—'}</dd></div>
              <div><dt className='text-gray-500'>Business type</dt><dd className='font-medium text-gray-900'>{client.businessType || '—'}</dd></div>
            </dl>
          </div>
          <div className='bg-white rounded-lg shadow border border-gray-100 p-4'>
            <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'>Account</h2>
            <dl className='space-y-2 text-sm'>
              <div><dt className='text-gray-500'>Status</dt><dd className='font-medium text-gray-900'>{client.status || 'Active'}</dd></div>
              <div><dt className='text-gray-500'>Client type</dt><dd className='font-medium text-gray-900'>{client.clientType || '—'}</dd></div>
              <div><dt className='text-gray-500'>Onboarded by</dt><dd className='font-medium text-gray-900'>{client.onboardBy?.name || '—'}</dd></div>
              <div><dt className='text-gray-500'>Onboard date</dt><dd className='font-medium text-gray-900'>{fmtDate(client.date)}</dd></div>
            </dl>
          </div>
          <div className='bg-white rounded-lg shadow border border-gray-100 p-4'>
            <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'>Location & services</h2>
            <dl className='space-y-2 text-sm'>
              <div>
                <dt className='text-gray-500'>Address</dt>
                <dd className='font-medium text-gray-900'>
                  {[client.address, client.city, client.state, client.pincode].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className='text-gray-500'>Services</dt>
                <dd className='font-medium text-gray-900'>
                  {Array.isArray(client.services) && client.services.length ? client.services.join(', ') : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className='mb-8 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
          No client linked to this project.
        </div>
      )}

      {/* Project overview */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8'>
        <div className='lg:col-span-2 bg-white rounded-lg shadow border border-gray-100 p-4'>
          <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'>Project overview</h2>
          <dl className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm'>
            <div><dt className='text-gray-500'>Status</dt><dd className='font-medium text-gray-900'>{project.status || '—'}</dd></div>
            <div><dt className='text-gray-500'>Priority</dt><dd className='font-medium text-gray-900'>{project.priority || '—'}</dd></div>
            <div><dt className='text-gray-500'>Department</dt><dd className='font-medium text-gray-900'>{project.department || 'IT'}</dd></div>
            <div><dt className='text-gray-500'>Progress</dt><dd className='font-medium text-gray-900'>{project.progress ?? 0}%</dd></div>
            <div className='sm:col-span-2'>
              <dt className='text-gray-500'>Description</dt>
              <dd className='font-medium text-gray-900 mt-0.5'>{project.description || '—'}</dd>
            </div>
            <div className='sm:col-span-2'>
              <dt className='text-gray-500'>Notes</dt>
              <dd className='font-medium text-gray-900 mt-0.5'>{project.notes || '—'}</dd>
            </div>
            {Array.isArray(project.services) && project.services.length > 0 && (
              <div className='sm:col-span-2'>
                <dt className='text-gray-500'>Project services</dt>
                <dd className='font-medium text-gray-900 mt-0.5'>{project.services.join(', ')}</dd>
              </div>
            )}
          </dl>
          <div className='mt-4 h-2 bg-gray-200 rounded-full overflow-hidden'>
            <div
              className='h-full bg-blue-500 rounded-full transition-all'
              style={{ width: `${Math.min(100, Math.max(0, Number(project.progress) || 0))}%` }}
            />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow border border-gray-100 p-4'>
          <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'>Schedule & team</h2>
          <dl className='space-y-2 text-sm'>
            <div><dt className='text-gray-500'>Start</dt><dd className='font-medium text-gray-900'>{fmtDate(project.startDate)}</dd></div>
            <div><dt className='text-gray-500'>End</dt><dd className='font-medium text-gray-900'>{fmtDate(project.endDate)}</dd></div>
            <div><dt className='text-gray-500'>Deadline</dt><dd className='font-medium text-gray-900'>{fmtDate(project.deadline)}</dd></div>
            <div><dt className='text-gray-500'>Project manager</dt><dd className='font-medium text-gray-900'>{project.projectManager?.name || '—'}</dd></div>
            <div>
              <dt className='text-gray-500'>Team</dt>
              <dd className='font-medium text-gray-900'>
                {Array.isArray(project.teamMembers) && project.teamMembers.length
                  ? project.teamMembers.map((m) => (typeof m === 'object' ? m.name : m)).filter(Boolean).join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Billing summary (invoices that include this project) */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
        <div className='bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-lg p-5 shadow'>
          <p className='text-sm opacity-80'>Invoices (this project)</p>
          <p className='text-3xl font-bold mt-1'>{bs.totalInvoicesGenerated ?? 0}</p>
        </div>
        <div className='bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-lg p-5 shadow'>
          <p className='text-sm opacity-80'>Total paid (recorded)</p>
          <p className='text-3xl font-bold mt-1'>{fmtMoney(bs.totalAmountPaid)}</p>
        </div>
        <div className='bg-gradient-to-br from-amber-700 to-amber-900 text-white rounded-lg p-5 shadow'>
          <p className='text-sm opacity-80'>Remaining (by billing)</p>
          <p className='text-3xl font-bold mt-1'>{fmtMoney(bs.totalAmountPending)}</p>
        </div>
      </div>

      {/* Finances for this project */}
      <section className='mb-10'>
        <h2 className='text-lg font-bold text-gray-900 mb-3'>Project finances</h2>
        <div className='bg-white rounded-lg shadow border border-gray-100 overflow-x-auto'>
          <table className='w-full text-sm min-w-[720px]'>
            <thead className={thead}>
              <tr>
                <th className={th}>Project</th>
                <th className={th}>Team lead</th>
                <th className={th}>Start</th>
                <th className={th}>End / deadline</th>
                <th className={th}>Project cost</th>
                <th className={th}>Paid</th>
                <th className={th}>Remaining</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className='border-b border-gray-100'>
                <td className='px-4 py-3 font-medium text-gray-900'>{project.projectName}</td>
                <td className='px-4 py-3'>{project.projectManager?.name || '—'}</td>
                <td className='px-4 py-3'>{fmtDate(project.startDate)}</td>
                <td className='px-4 py-3'>{fmtDate(project.deadline || project.endDate)}</td>
                <td className='px-4 py-3'>{fmtMoney(f.projectCostBilling ?? project.budget)}</td>
                <td className='px-4 py-3 text-emerald-700 font-medium'>{fmtMoney(f.paidFromBilling)}</td>
                <td className='px-4 py-3 text-amber-800 font-medium'>{fmtMoney(f.remainingAmount)}</td>
                <td className='px-4 py-3'><span className='px-2 py-0.5 rounded-full text-xs bg-gray-100'>{project.status || '—'}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className='mb-10'>
        <h2 className='text-lg font-bold text-gray-900 mb-3'>Invoices & billing</h2>
        <p className='text-xs text-gray-500 mb-3'>Invoices from the client that include this project.</p>
        <div className='bg-white rounded-lg shadow border border-gray-100 overflow-x-auto'>
          <table className='w-full text-sm min-w-[720px]'>
            <thead className={thead}>
              <tr>
                <th className={th}>Invoice #</th>
                <th className={th}>Type</th>
                <th className={th}>Date</th>
                <th className={th}>Payment amount</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {billings.length === 0 ? (
                <tr><td colSpan={5} className='px-4 py-8 text-center text-gray-500'>No invoices for this project yet.</td></tr>
              ) : (
                billings.map((b) => (
                  <tr key={b._id} className='border-b border-gray-100 hover:bg-gray-50'>
                    <td className='px-4 py-3 font-mono text-xs'>{b.invoiceNumber || '—'}</td>
                    <td className='px-4 py-3'>{b.billType || '—'}</td>
                    <td className='px-4 py-3'>{fmtDate(b.createdAt)}</td>
                    <td className='px-4 py-3 font-medium'>{fmtMoney(b.paymentDetails?.amount)}</td>
                    <td className='px-4 py-3'>
                      <button
                        type='button'
                        onClick={() => navigate(`/billings/${b._id}/invoice`)}
                        className='text-blue-600 text-sm font-medium hover:underline'
                      >
                        View invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className='mb-10'>
        <h2 className='text-lg font-bold text-gray-900 mb-1'>Task history</h2>
        <p className='text-xs text-gray-500 mb-3'>Click a row to view full task details.</p>
        <div className='bg-white rounded-lg shadow border border-gray-100 overflow-x-auto max-h-[480px] overflow-y-auto'>
          <table className='w-full text-sm'>
            <thead className={`${thead} sticky top-0 z-10`}>
              <tr>
                <th className={th}>Task</th>
                <th className={th}>Assign to</th>
                <th className={th}>Assigned by</th>
                <th className={th}>Assigned on</th>
                <th className={th}>Status</th>
                <th className={th}>Completed on</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={6} className='px-4 py-8 text-center text-gray-500'>No tasks.</td></tr>
              ) : (
                tasks.map((t) => (
                  <tr
                    key={t._id}
                    role='button'
                    tabIndex={0}
                    onClick={() => openTaskModal(t._id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openTaskModal(t._id)
                      }
                    }}
                    className='border-b border-gray-100 hover:bg-blue-50/60 cursor-pointer transition-colors'
                  >
                    <td className='px-4 py-3 font-medium max-w-[200px]'><span className='line-clamp-2'>{t.title}</span></td>
                    <td className='px-4 py-3 font-medium text-gray-900'>{t.assignedTo?.name || '—'}</td>
                    <td className='px-4 py-3'>
                      {t.assignedBy ? (
                        <div>
                          <div className='font-medium text-gray-900'>{t.assignedBy.name || '—'}</div>
                          {t.assignedBy.email ? (
                            <div className='text-xs text-gray-500 mt-0.5'>{t.assignedBy.email}</div>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className='px-4 py-3 whitespace-nowrap'>{fmtDate(t.createdAt)}</td>
                    <td className='px-4 py-3'>{t.status}</td>
                    <td className='px-4 py-3 whitespace-nowrap'>
                      {t.status === 'Completed'
                        ? fmtDate(t.completedAt || t.updatedAt)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className='text-lg font-bold text-gray-900 mb-3'>Work history</h2>
        <p className='text-xs text-gray-500 mb-3'>Recent invoices, milestones, and task updates (newest first).</p>
        <ul className='space-y-2'>
          {workHistory.length === 0 ? (
            <li className='text-gray-500 text-sm'>No activity yet.</li>
          ) : (
            workHistory.map((w, i) => (
              <li
                key={`${w.type}-${w.id}-${i}`}
                className='flex flex-wrap gap-3 items-start bg-white border border-gray-100 rounded-lg px-4 py-3 shadow-sm'
              >
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  w.type === 'invoice' ? 'bg-cyan-100 text-cyan-900' :
                  w.type === 'project' ? 'bg-purple-100 text-purple-900' :
                  'bg-amber-100 text-amber-900'
                }`}>
                  {w.type}
                </span>
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-gray-900 text-sm'>{w.label}</p>
                  <p className='text-xs text-gray-600 mt-0.5'>{w.detail}</p>
                </div>
                <span className='text-xs text-gray-500 whitespace-nowrap'>{fmtDate(w.at)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {taskModalOpen && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50'
          role='presentation'
          onClick={closeTaskModal}
        >
          <div
            className='bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200'
            role='dialog'
            aria-modal='true'
            aria-labelledby='task-detail-title'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50'>
              <h2 id='task-detail-title' className='text-lg font-bold text-gray-900 pr-8'>
                Task details
              </h2>
              <button
                type='button'
                onClick={closeTaskModal}
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
              {taskDetailLoading && <p className='text-sm text-gray-600'>Loading…</p>}
              {taskDetailError && <p className='text-sm text-red-600'>{taskDetailError}</p>}
              {!taskDetailLoading && !taskDetailError && taskDetail && (
                <dl>
                  <DetailRow label='Title'>{taskDetail.title}</DetailRow>
                  <DetailRow label='Description'>
                    {taskDetail.description ? <span className='whitespace-pre-wrap'>{taskDetail.description}</span> : '—'}
                  </DetailRow>
                  <DetailRow label='Status'>{taskDetail.status}</DetailRow>
                  <DetailRow label='Priority'>{taskDetail.priority || '—'}</DetailRow>
                  <DetailRow label='Due date'>{fmtDate(taskDetail.dueDate)}</DetailRow>
                  <DetailRow label='Assigned on'>{fmtDateTime(taskDetail.createdAt)}</DetailRow>
                  <DetailRow label='Last updated'>{fmtDateTime(taskDetail.updatedAt)}</DetailRow>
                  <DetailRow label='Completed on'>
                    {taskDetail.status === 'Completed'
                      ? fmtDateTime(taskDetail.completedAt || taskDetail.updatedAt)
                      : '—'}
                  </DetailRow>
                  <DetailRow label='Assign to'>
                    {taskDetail.assignedTo?.name || '—'}
                    {taskDetail.assignedTo?.email ? (
                      <span className='block text-xs text-gray-500 mt-0.5'>{taskDetail.assignedTo.email}</span>
                    ) : null}
                  </DetailRow>
                  <DetailRow label='Assigned by'>
                    {taskDetail.assignedBy?.name || '—'}
                    {taskDetail.assignedBy?.email ? (
                      <span className='block text-xs text-gray-500 mt-0.5'>{taskDetail.assignedBy.email}</span>
                    ) : null}
                  </DetailRow>
                  {taskDetail.project && (
                    <>
                      <DetailRow label='Project'>{taskDetail.project.projectName || '—'}</DetailRow>
                      <DetailRow label='Project status'>{taskDetail.project.status || '—'}</DetailRow>
                      <DetailRow label='Department'>{taskDetail.project.department || '—'}</DetailRow>
                      <DetailRow label='Project budget'>{fmtMoney(taskDetail.project.budget)}</DetailRow>
                      <DetailRow label='Start date'>{fmtDate(taskDetail.project.startDate)}</DetailRow>
                      <DetailRow label='End / deadline'>
                        {fmtDate(taskDetail.project.deadline || taskDetail.project.endDate)}
                      </DetailRow>
                    </>
                  )}
                  {(taskDetail.recurrenceEnabled ||
                    taskDetail.isRecurringTemplate ||
                    taskDetail.recurrenceType) && (
                    <>
                      <div className='pt-4 pb-1 text-xs font-bold text-gray-500 uppercase tracking-wide'>Recurrence</div>
                      <DetailRow label='Template'>{taskDetail.isRecurringTemplate ? 'Yes' : 'No'}</DetailRow>
                      <DetailRow label='Recurrence enabled'>{taskDetail.recurrenceEnabled ? 'Yes' : 'No'}</DetailRow>
                      <DetailRow label='Frequency'>{taskDetail.recurrenceType || '—'}</DetailRow>
                      <DetailRow label='Every (interval)'>{taskDetail.recurrenceInterval ?? '—'}</DetailRow>
                      <DetailRow label='Recurrence start'>{fmtDate(taskDetail.recurrenceStartDate)}</DetailRow>
                      <DetailRow label='Recurrence end'>{fmtDate(taskDetail.recurrenceEndDate)}</DetailRow>
                      <DetailRow label='Next run'>{fmtDateTime(taskDetail.nextRunAt)}</DetailRow>
                      <DetailRow label='Scheduled for'>{fmtDate(taskDetail.recurringScheduledFor)}</DetailRow>
                    </>
                  )}
                  <DetailRow label='Task ID'>
                    <span className='font-mono text-xs'>{String(taskDetail._id)}</span>
                  </DetailRow>
                </dl>
              )}
            </div>
            <div className='px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end'>
              <button
                type='button'
                onClick={closeTaskModal}
                className='px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDashboardView
