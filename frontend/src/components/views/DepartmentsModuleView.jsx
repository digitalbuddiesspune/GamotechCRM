import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import {
  buildDepartmentOptions,
  CUSTOM_DEPARTMENTS_STORAGE_KEY,
  normalizeDepartment,
} from '../../utils/departmentOptions'

const DepartmentsModuleView = () => {
  const [employees, setEmployees] = useState([])
  const [designations, setDesignations] = useState([])
  const [customDepartments, setCustomDepartments] = useState([])
  const [newDepartment, setNewDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CUSTOM_DEPARTMENTS_STORAGE_KEY) || '[]')
      setCustomDepartments(Array.isArray(stored) ? stored.map(normalizeDepartment).filter(Boolean) : [])
    } catch {
      setCustomDepartments([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(CUSTOM_DEPARTMENTS_STORAGE_KEY, JSON.stringify(customDepartments))
  }, [customDepartments])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        const [employeesRes, designationsRes] = await Promise.all([
          api.get('/employees'),
          api.get('/designations'),
        ])
        const employeeList = Array.isArray(employeesRes.data)
          ? employeesRes.data
          : employeesRes.data?.data || []
        const designationList = Array.isArray(designationsRes.data)
          ? designationsRes.data
          : designationsRes.data?.data || []
        if (!cancelled) {
          setEmployees(employeeList)
          setDesignations(designationList)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load departments')
          setEmployees([])
          setDesignations([])
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

  const allDepartments = useMemo(
    () => buildDepartmentOptions({ employees, designations, customDepartments }),
    [employees, designations, customDepartments]
  )

  const addDepartment = () => {
    const name = normalizeDepartment(newDepartment)
    if (!name) return
    if (allDepartments.some((d) => d.toLowerCase() === name.toLowerCase())) {
      setNewDepartment('')
      return
    }
    setCustomDepartments((prev) => [...prev, name])
    setNewDepartment('')
  }

  const removeCustomDepartment = (name) => {
    setCustomDepartments((prev) => prev.filter((d) => d !== name))
  }

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading departments…</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Departments</h1>
        <p className='text-sm text-gray-600 mt-1'>
          Create and maintain department names used across employee and designation records.
        </p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6'>
        <h2 className='text-sm font-semibold text-gray-900 mb-3'>Create Department</h2>
        <div className='flex flex-col sm:flex-row gap-2'>
          <input
            type='text'
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder='Department name (e.g. Operations)'
            className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='button'
            onClick={addDepartment}
            className='px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700'
          >
            Add Department
          </button>
        </div>
      </div>

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-5 py-4 border-b border-gray-100'>
          <h2 className='text-sm font-semibold text-gray-900'>Department list ({allDepartments.length})</h2>
        </div>
        <div className='p-4'>
          {allDepartments.length ? (
            <div className='flex flex-wrap gap-2'>
              {allDepartments.map((department) => {
                const isCustom = customDepartments.includes(department)
                return (
                  <span
                    key={department}
                    className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-blue-50 border-blue-200 text-blue-800'
                  >
                    {department}
                    {isCustom && (
                      <button
                        type='button'
                        onClick={() => removeCustomDepartment(department)}
                        className='text-blue-700 hover:text-blue-900'
                        aria-label={`Remove ${department}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className='text-sm text-gray-500'>No departments available yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DepartmentsModuleView
