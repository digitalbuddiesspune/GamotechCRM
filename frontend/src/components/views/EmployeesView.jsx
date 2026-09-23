import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import { EditIcon, ViewIcon } from '../Icons'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const statusStyles = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'On Leave': 'bg-amber-50 text-amber-700 border-amber-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
}

const isActiveRecord = (employee) => {
  const status = employee?.employmentStatus || employee?.status || 'Active'
  return status === 'Active'
}

const isInactiveRecord = (employee) => !isActiveRecord(employee)

const getDesignationTitle = (employee) =>
  employee?.designation?.title || employee?.designation?.name || employee?.designation || '—'

const getEmployeeCode = (employee) => employee?.employeeCode?.trim() || '—'

const getEmployeePhone = (employee) =>
  employee?.officialMobile?.trim() || employee?.personalMobile?.trim() || '—'

const isOnLeaveToday = (employeeId, leaves) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return leaves.some((leave) => {
    if ((leave.status || '').toLowerCase() !== 'approved') return false
    const leaveEmpId = leave.employee?._id || leave.employee
    if (String(leaveEmpId) !== String(employeeId)) return false
    const start = new Date(leave.startDate)
    const end = new Date(leave.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return today >= start && today <= end
  })
}

const resolveDisplayStatus = (employee, leaves) => {
  if (isOnLeaveToday(employee._id, leaves)) return 'On Leave'
  if (isActiveRecord(employee)) return 'Active'
  return 'Inactive'
}

const StatCard = ({ title, value, subtitle, icon, iconBg }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500'>{title}</p>
        <p className='text-3xl font-bold text-gray-900 mt-1'>{value}</p>
        {subtitle && <p className='text-xs text-gray-400 mt-1'>{subtitle}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const EmployeeAvatar = ({ employee }) => {
  const [imgError, setImgError] = useState(false)
  const name = employee?.name || '?'
  const photo = employee?.profilePhoto
  const showPhoto = Boolean(photo) && !imgError

  return (
    <div className='w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden border border-gray-200'>
      {showPhoto ? (
        <img
          src={photo}
          alt={name}
          className='w-full h-full object-cover'
          onError={() => setImgError(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

const StatusBadge = ({ status }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[status] || statusStyles.Inactive}`}>
    {status}
  </span>
)

const MoreVerticalIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='size-4'>
    <path d='M12 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z' />
  </svg>
)

const FilterIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='size-4'>
    <path strokeLinecap='round' strokeLinejoin='round' d='M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.036a2.5 2.5 0 0 1-.659 1.591l-5.432 6.198a2.5 2.5 0 0 0-.659 1.591v2.927a.75.75 0 0 1-1.28.53l-3.18-3.18a.75.75 0 0 1-.22-.53v-2.717a2.5 2.5 0 0 0-.659-1.591L3.659 7.409A2.5 2.5 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z' />
  </svg>
)

const buildPageNumbers = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: 'page', value: i + 1 }))
  }
  const items = []
  const addPage = (value) => items.push({ type: 'page', value })
  const addEllipsis = (key) => items.push({ type: 'ellipsis', key })

  addPage(1)
  if (page > 3) addEllipsis('start')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i += 1) addPage(i)

  if (page < totalPages - 2) addEllipsis('end')
  addPage(totalPages)

  return items
}

const EmployeesView = () => {
  const [searchParams] = useSearchParams()
  const focusId = (searchParams.get('focus') || '').trim()
  const navigate = useNavigate()

  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      setError(null)
      const [empRes, leaveRes] = await Promise.all([
        api.get('/employees'),
        api.get('/leave').catch(() => ({ data: [] })),
      ])
      const payload = empRes.data
      let list = []
      if (Array.isArray(payload)) list = payload
      else if (payload && Array.isArray(payload.data)) list = payload.data
      else if (payload && Array.isArray(payload.employees)) list = payload.employees
      else if (payload && typeof payload === 'object') list = [payload]
      setEmployees(list)
      setLeaves(Array.isArray(leaveRes.data) ? leaveRes.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (!focusId || loading) return undefined
    const t = window.setTimeout(() => {
      document.getElementById(`employee-focus-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [focusId, loading, employees.length])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, departmentFilter, designationFilter, statusFilter, pageSize])

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [employees])

  const designations = useMemo(() => {
    const set = new Set(employees.map((e) => getDesignationTitle(e)).filter((d) => d && d !== '—'))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [employees])

  const employeesWithStatus = useMemo(
    () =>
      employees.map((emp) => ({
        emp,
        displayStatus: resolveDisplayStatus(emp, leaves),
        code: getEmployeeCode(emp),
      })),
    [employees, leaves]
  )

  const stats = useMemo(() => {
    const total = employees.length
    const active = employees.filter((e) => isActiveRecord(e)).length
    const inactive = employees.filter((e) => isInactiveRecord(e)).length
    const onLeave = employees.filter((e) => isOnLeaveToday(e._id, leaves)).length
    const activePct = total ? ((active / total) * 100).toFixed(1) : '0'
    const inactivePct = total ? ((inactive / total) * 100).toFixed(1) : '0'
    return { total, active, inactive, onLeave, activePct, inactivePct }
  }, [employees, leaves])

  const filteredRows = useMemo(() => {
    let rows = employeesWithStatus
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter(({ emp, code }) => {
        const designation = getDesignationTitle(emp).toLowerCase()
        return (
          emp.name?.toLowerCase().includes(q) ||
          emp.email?.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          emp.employeeCode?.toLowerCase().includes(q) ||
          emp._id?.toLowerCase().includes(q) ||
          designation.includes(q)
        )
      })
    }
    if (departmentFilter) {
      rows = rows.filter(({ emp }) => emp.department === departmentFilter)
    }
    if (designationFilter) {
      rows = rows.filter(({ emp }) => getDesignationTitle(emp) === designationFilter)
    }
    if (statusFilter) {
      rows = rows.filter(({ displayStatus }) => displayStatus === statusFilter)
    }
    return rows
  }, [employeesWithStatus, searchQuery, departmentFilter, designationFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageNumbers = buildPageNumbers(safePage, totalPages)

  const showingFrom = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const showingTo = Math.min(safePage * pageSize, filteredRows.length)

  const resetFilters = () => {
    setSearchQuery('')
    setDepartmentFilter('')
    setDesignationFilter('')
    setStatusFilter('')
  }

  const handleDelete = async (id) => {
    setOpenMenuId(null)
    if (!window.confirm('Are you sure you want to delete this employee?')) return
    try {
      await api.delete(`/employees/${id}`)
      fetchEmployees()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting employee')
    }
  }

  return (
    <div className='min-h-full bg-[#f4f6f8]'>
      <div className='px-6 md:px-8 py-6 border-b border-gray-200 bg-white'>
        <nav className='text-sm text-gray-500 mb-2'>
          <button type='button' onClick={() => navigate('/dashboard')} className='hover:text-blue-600'>
            Dashboard
          </button>
          <span className='mx-2 text-gray-300'>›</span>
          <span className='text-gray-900 font-medium'>Employees</span>
        </nav>
        <h1 className='text-2xl font-bold text-gray-900'>Employees</h1>
      </div>

      <div className='p-6 md:px-8 md:py-6 space-y-6'>
        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
          <StatCard title='Total Employees' value={stats.total} subtitle='All Departments' icon='👥' iconBg='bg-blue-100 text-blue-600' />
          <StatCard title='Active Employees' value={stats.active} subtitle={`${stats.activePct}% of total`} icon='✓' iconBg='bg-emerald-100 text-emerald-600' />
          <StatCard title='On Leave' value={stats.onLeave} subtitle='Today' icon='🌴' iconBg='bg-amber-100 text-amber-600' />
          <StatCard title='Inactive' value={stats.inactive} subtitle={`${stats.inactivePct}% of total`} icon='⊘' iconBg='bg-violet-100 text-violet-600' />
        </div>

        <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
          <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-2 flex-1 min-w-[240px]'>
              <input
                type='search'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search employee by name, email or ID…'
                className='flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 min-w-[150px]'
              >
                <option value=''>All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={designationFilter}
                onChange={(e) => setDesignationFilter(e.target.value)}
                className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 min-w-[150px]'
              >
                <option value=''>All Designations</option>
                {designations.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 min-w-[130px]'
              >
                <option value=''>All Status</option>
                <option value='Active'>Active</option>
                <option value='On Leave'>On Leave</option>
                <option value='Inactive'>Inactive</option>
              </select>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                onClick={resetFilters}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50'
              >
                <FilterIcon />
                Filters
              </button>
              <button
                type='button'
                onClick={() => navigate('/add-employee')}
                className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700'
              >
                <span className='text-lg leading-none'>+</span>
                Add Employee
              </button>
            </div>
          </div>

          {loading ? (
            <p className='px-5 py-12 text-sm text-gray-500 text-center'>Loading employees…</p>
          ) : error ? (
            <p className='px-5 py-12 text-sm text-red-600 text-center'>{error}</p>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                      <th className='px-5 py-3'>Employee</th>
                      <th className='px-5 py-3'>Department</th>
                      <th className='px-5 py-3'>Designation</th>
                      <th className='px-5 py-3'>Email</th>
                      <th className='px-5 py-3'>Phone</th>
                      <th className='px-5 py-3'>Status</th>
                      <th className='px-5 py-3 text-right'>Action</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className='px-5 py-12 text-center text-gray-500'>
                          No employees match your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map(({ emp, displayStatus }) => (
                        <tr
                          key={emp._id}
                          id={`employee-focus-${emp._id}`}
                          className={`hover:bg-gray-50/80 ${
                            focusId && String(emp._id) === focusId ? 'bg-amber-50 ring-2 ring-inset ring-blue-500' : ''
                          }`}
                        >
                          <td className='px-5 py-3'>
                            <div className='flex items-center gap-3'>
                              <EmployeeAvatar employee={emp} />
                              <div>
                                <p className='font-medium text-gray-900'>{emp.name}</p>
                                <p className='text-xs text-gray-400'>{getDesignationTitle(emp)}</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-5 py-3 text-gray-700'>{emp.department || '—'}</td>
                          <td className='px-5 py-3 text-gray-700'>{getDesignationTitle(emp)}</td>
                          <td className='px-5 py-3 text-gray-600'>{emp.email || '—'}</td>
                          <td className='px-5 py-3 text-gray-600 whitespace-nowrap'>{getEmployeePhone(emp)}</td>
                          <td className='px-5 py-3'><StatusBadge status={displayStatus} /></td>
                          <td className='px-5 py-3'>
                            <div className='flex items-center justify-end gap-1'>
                              <button
                                type='button'
                                onClick={() => navigate(`/employees/${emp._id}/profile`)}
                                className='p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors'
                                title='View'
                              >
                                <ViewIcon />
                              </button>
                              <button
                                type='button'
                                onClick={() => navigate(`/employees/edit/${emp._id}`)}
                                className='p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors'
                                title='Edit'
                              >
                                <EditIcon />
                              </button>
                              <div className='relative' ref={openMenuId === emp._id ? menuRef : null}>
                                <button
                                  type='button'
                                  onClick={() => setOpenMenuId((prev) => (prev === emp._id ? null : emp._id))}
                                  className='p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors'
                                  title='More'
                                >
                                  <MoreVerticalIcon />
                                </button>
                                {openMenuId === emp._id && (
                                  <div className='absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-gray-200 bg-white shadow-lg py-1'>
                                    <button
                                      type='button'
                                      onClick={() => navigate(`/employees/${emp._id}/profile`)}
                                      className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50'
                                    >
                                      View profile
                                    </button>
                                    <button
                                      type='button'
                                      onClick={() => navigate(`/employees/edit/${emp._id}`)}
                                      className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50'
                                    >
                                      Edit employee
                                    </button>
                                    <button
                                      type='button'
                                      onClick={() => handleDelete(emp._id)}
                                      className='w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50'
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className='px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500'>
                <span>
                  Showing {showingFrom} to {showingTo} of {filteredRows.length} employees
                </span>
                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    type='button'
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                  >
                    ‹
                  </button>
                  {pageNumbers.map((item) =>
                    item.type === 'ellipsis' ? (
                      <span key={item.key} className='px-1 text-gray-400'>…</span>
                    ) : (
                      <button
                        key={item.value}
                        type='button'
                        onClick={() => setPage(item.value)}
                        className={`min-w-[32px] px-2 py-1 rounded border text-sm ${
                          item.value === safePage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {item.value}
                      </button>
                    )
                  )}
                  <button
                    type='button'
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                  >
                    ›
                  </button>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className='ml-2 border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white text-gray-700'
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} / page</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmployeesView
