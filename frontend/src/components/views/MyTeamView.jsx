import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

const STATUS_STYLES = {
  Online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Away: 'bg-amber-50 text-amber-700 border-amber-200',
  'On Leave': 'bg-purple-50 text-purple-700 border-purple-200',
  Offline: 'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_DOTS = {
  Online: 'bg-emerald-500',
  Away: 'bg-amber-500',
  'On Leave': 'bg-purple-500',
  Offline: 'bg-gray-400',
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

const MyTeamView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [empRes, taskRes, attRes, leaveRes] = await Promise.all([
          api.get('/employees').catch(() => ({ data: [] })),
          api.get('/tasks').catch(() => ({ data: [] })),
          api.get('/attendance/today').catch(() => ({ data: [] })),
          api.get('/leave').catch(() => ({ data: [] })),
        ])
        const list = (res) => (Array.isArray(res.data) ? res.data : res.data?.data || [])
        setEmployees(list(empRes))
        setTasks(list(taskRes))
        setAttendance(list(attRes))
        setLeaves(list(leaveRes))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const members = useMemo(() => {
    const now = new Date()
    const perMember = {}
    tasks.forEach((t) => {
      const id = String(t.assignedTo?._id || t.assignedTo || '')
      if (!id) return
      if (!perMember[id]) perMember[id] = { total: 0, completed: 0, inProgress: 0 }
      perMember[id].total += 1
      if (t.status === 'Completed') perMember[id].completed += 1
      if (t.status === 'In Progress') perMember[id].inProgress += 1
    })

    return employees
      .filter(
        (e) =>
          e.status === 'Active' &&
          String(e.reportingManager?._id || e.reportingManager || '') === String(user?._id)
      )
      .map((e) => {
        const att = attendance.find((a) => String(a.employee?._id || a.employee) === String(e._id))
        const onLeave = leaves.some(
          (l) =>
            String(l.employee?._id || l.employee) === String(e._id) &&
            l.status === 'Approved' &&
            new Date(l.startDate) <= now &&
            new Date(l.endDate) >= new Date(now.toDateString())
        )
        let status = 'Offline'
        if (onLeave) status = 'On Leave'
        else if (att?.checkOut) status = 'Away'
        else if (att?.checkIn) status = 'Online'
        const m = perMember[String(e._id)] || { total: 0, completed: 0, inProgress: 0 }
        return {
          id: e._id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          role: e.designation?.title || '—',
          department: e.department || e.designation?.department || '—',
          status,
          openTasks: m.total - m.completed,
          inProgress: m.inProgress,
          completed: m.completed,
          progress: m.total ? Math.round((m.completed / m.total) * 100) : 0,
        }
      })
  }, [employees, tasks, attendance, leaves, user])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (statusFilter !== 'All' && m.status !== statusFilter) return false
      if (!q) return true
      return (
        m.name?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      )
    })
  }, [members, search, statusFilter])

  const summary = useMemo(
    () => ({
      total: members.length,
      online: members.filter((m) => m.status === 'Online').length,
      onLeave: members.filter((m) => m.status === 'On Leave').length,
      openTasks: members.reduce((sum, m) => sum + m.openTasks, 0),
    }),
    [members]
  )

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64 text-gray-400 text-sm'>
        Loading team...
      </div>
    )
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f4f6f9] min-h-full space-y-5'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div>
          <h1 className='text-xl font-bold text-gray-900'>My Team</h1>
          <p className='text-sm text-gray-500'>Overview of your team members and their workload</p>
        </div>
        <button
          type='button'
          onClick={() => navigate('/assign-task')}
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
        >
          + Assign Task
        </button>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Team Members</p>
          <p className='text-2xl font-bold text-gray-900 mt-1'>{summary.total}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Online Now</p>
          <p className='text-2xl font-bold text-emerald-600 mt-1'>{summary.online}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>On Leave</p>
          <p className='text-2xl font-bold text-purple-600 mt-1'>{summary.onLeave}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Open Tasks</p>
          <p className='text-2xl font-bold text-amber-600 mt-1'>{summary.openTasks}</p>
        </div>
      </div>

      <div className='bg-white rounded-xl border border-gray-100 shadow-sm'>
        <div className='flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100'>
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by name, role or email...'
            className='flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='All'>All Statuses</option>
            <option value='Online'>Online</option>
            <option value='Away'>Away</option>
            <option value='On Leave'>On Leave</option>
            <option value='Offline'>Offline</option>
          </select>
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead>
              <tr className='text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100'>
                <th className='px-4 py-3 font-medium'>Member</th>
                <th className='px-4 py-3 font-medium'>Department</th>
                <th className='px-4 py-3 font-medium'>Status</th>
                <th className='px-4 py-3 font-medium text-center'>Open</th>
                <th className='px-4 py-3 font-medium text-center'>In Progress</th>
                <th className='px-4 py-3 font-medium text-center'>Completed</th>
                <th className='px-4 py-3 font-medium'>Progress</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filtered.map((m, i) => (
                <tr key={m.id} className='hover:bg-gray-50/60'>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                      >
                        {initials(m.name)}
                      </div>
                      <div className='min-w-0'>
                        <p className='font-medium text-gray-900 truncate'>{m.name}</p>
                        <p className='text-xs text-gray-500 truncate'>{m.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-gray-600'>{m.department}</td>
                  <td className='px-4 py-3'>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[m.status]}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[m.status]}`} />
                      {m.status}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-center font-medium text-gray-900'>{m.openTasks}</td>
                  <td className='px-4 py-3 text-center text-gray-600'>{m.inProgress}</td>
                  <td className='px-4 py-3 text-center text-gray-600'>{m.completed}</td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2 min-w-[120px]'>
                      <div className='flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-blue-500'
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                      <span className='text-xs text-gray-500 w-8 text-right'>{m.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-sm text-gray-400'>
                    No team members found
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

export default MyTeamView
