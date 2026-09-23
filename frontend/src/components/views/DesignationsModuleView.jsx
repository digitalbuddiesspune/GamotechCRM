import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import {
  buildDepartmentOptions,
  CUSTOM_DEPARTMENTS_STORAGE_KEY,
  readCustomDepartments,
} from '../../utils/departmentOptions'

const emptyForm = {
  title: '',
  department: '',
  level: '',
  accessRole: 'employee',
  sortOrder: '',
}

const designationToForm = (designation) => ({
  title: designation?.title || '',
  department: designation?.department || '',
  level: designation?.level || '',
  accessRole: designation?.accessRole || 'employee',
  sortOrder:
    designation?.sortOrder === 0 || designation?.sortOrder
      ? String(designation.sortOrder)
      : '',
})

const DesignationsModuleView = () => {
  const [designations, setDesignations] = useState([])
  const [employees, setEmployees] = useState([])
  const [customDepartments, setCustomDepartments] = useState(() => readCustomDepartments())
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [designationsRes, employeesRes] = await Promise.all([
        api.get('/designations'),
        api.get('/employees'),
      ])
      const list = Array.isArray(designationsRes.data)
        ? designationsRes.data
        : designationsRes.data?.data || designationsRes.data?.designations || []
      const employeeList = Array.isArray(employeesRes.data)
        ? employeesRes.data
        : employeesRes.data?.data || []
      setDesignations(Array.isArray(list) ? list : [])
      setEmployees(Array.isArray(employeeList) ? employeeList : [])
      setCustomDepartments(readCustomDepartments())
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load designations')
      setDesignations([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const syncCustomDepartments = () => setCustomDepartments(readCustomDepartments())
    const onStorage = (event) => {
      if (event.key === CUSTOM_DEPARTMENTS_STORAGE_KEY) syncCustomDepartments()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', syncCustomDepartments)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', syncCustomDepartments)
    }
  }, [])

  const departmentOptions = useMemo(
    () => buildDepartmentOptions({ employees, designations, customDepartments }),
    [employees, designations, customDepartments]
  )

  const sortedDesignations = useMemo(
    () => [...designations].sort((a, b) => {
      const orderA = Number(a.sortOrder ?? 999)
      const orderB = Number(b.sortOrder ?? 999)
      if (orderA !== orderB) return orderA - orderB
      return String(a.title || '').localeCompare(String(b.title || ''))
    }),
    [designations]
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const startEdit = (designation) => {
    setEditingId(designation._id)
    setForm(designationToForm(designation))
    setError(null)
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveDesignation = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      setSaving(true)
      setError(null)
      setSuccess('')
      const payload = {
        title: form.title.trim(),
        department: form.department.trim(),
        level: form.level,
        accessRole: form.accessRole,
      }
      if (form.sortOrder !== '' && form.sortOrder != null) {
        payload.sortOrder = Number(form.sortOrder)
      }
      if (editingId) {
        await api.put(`/designations/${editingId}`, payload)
        setSuccess('Designation updated successfully.')
      } else {
        await api.post('/designations', payload)
        setSuccess('Designation created successfully.')
      }
      resetForm()
      await fetchData()
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingId ? 'Failed to update designation' : 'Failed to create designation')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading designations…</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Designations</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Create and edit designations to keep role structure organized.
        </p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}
      {success && (
        <div className='mb-4 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700'>
          {success}
        </div>
      )}

      <form onSubmit={saveDesignation} className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6'>
        <h2 className='text-sm font-semibold text-gray-900 mb-4'>
          {editingId ? 'Edit Designation' : 'Create Designation'}
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder='Title (e.g. Video Editor)'
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            required
          />
          <select
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>Select department</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <select
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>Level</option>
            <option value='Entry'>Entry</option>
            <option value='Junior'>Junior</option>
            <option value='Mid'>Mid</option>
            <option value='Senior'>Senior</option>
            <option value='Lead'>Lead</option>
            <option value='Manager'>Manager</option>
            <option value='Director'>Director</option>
            <option value='Executive'>Executive</option>
          </select>
          <select
            value={form.accessRole}
            onChange={(e) => setForm((f) => ({ ...f, accessRole: e.target.value }))}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='employee'>Employee</option>
            <option value='manager'>Manager</option>
            <option value='team_leader'>Team Leader</option>
            <option value='technical_lead'>Technical Lead</option>
            <option value='hr'>HR</option>
            <option value='admin'>Admin</option>
          </select>
        </div>
        <div className='mt-3 flex flex-wrap items-center gap-3'>
          <input
            type='number'
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            placeholder='Sort order'
            className='w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='submit'
            disabled={saving}
            className='px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50'
          >
            {saving
              ? editingId
                ? 'Saving…'
                : 'Creating…'
              : editingId
                ? 'Save Changes'
                : 'Create Designation'}
          </button>
          {editingId ? (
            <button
              type='button'
              onClick={resetForm}
              disabled={saving}
              className='px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50'
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-5 py-4 border-b border-gray-100'>
          <h2 className='text-sm font-semibold text-gray-900'>Designation list ({sortedDesignations.length})</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
              <tr>
                <th className='px-4 py-3'>Title</th>
                <th className='px-4 py-3'>Department</th>
                <th className='px-4 py-3'>Level</th>
                <th className='px-4 py-3'>Access Role</th>
                <th className='px-4 py-3'>Employees</th>
                <th className='px-4 py-3'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {sortedDesignations.length ? sortedDesignations.map((designation) => (
                <tr
                  key={designation._id}
                  className={editingId === designation._id ? 'bg-indigo-50/60' : undefined}
                >
                  <td className='px-4 py-3 font-medium text-gray-900'>{designation.title || '—'}</td>
                  <td className='px-4 py-3 text-gray-700'>{designation.department || '—'}</td>
                  <td className='px-4 py-3 text-gray-700'>{designation.level || '—'}</td>
                  <td className='px-4 py-3 text-gray-700'>{designation.accessRole || 'employee'}</td>
                  <td className='px-4 py-3 text-gray-700'>{designation.employeeCount ?? 0}</td>
                  <td className='px-4 py-3'>
                    <button
                      type='button'
                      onClick={() => startEdit(designation)}
                      className='text-indigo-600 hover:text-indigo-800 font-medium text-sm'
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className='px-4 py-12 text-center text-gray-500'>
                    No designations found.
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

export default DesignationsModuleView
