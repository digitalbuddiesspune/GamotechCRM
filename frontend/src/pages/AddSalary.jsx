import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { getSalaryStructure, salaryFormFromStructure, salaryInputFromForm } from '../utils/salaryCalculator'

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
]

const AddSalary = () => {
  const [form, setForm] = useState({
    employee: '',
    amount: '',
    ctc: '',
    basicSalary: '',
    da: '',
    hra: '',
    conveyance: '',
    specialAllowance: '',
    medicalAllowance: '',
    employerPf: '',
    employeePf: '',
    pt: '',
    tds: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: 'Unpaid',
  })
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeOpen, setEmployeeOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const employeeRef = useRef(null)

  const navigate = useNavigate()

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees')
        const payload = res.data
        setEmployees(Array.isArray(payload) ? payload : payload?.data || [])
      } catch (err) {
        console.error('Failed to fetch employees:', err)
      }
    }
    fetchEmployees()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (employeeRef.current && !employeeRef.current.contains(e.target)) setEmployeeOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredEmployees = employees.filter((e) =>
    (e.name || '').toLowerCase().includes(employeeSearch.toLowerCase())
  )

  const selectedEmployee = employees.find((e) => e._id === form.employee)

  const handleEmployeeSelect = (emp) => {
    const payroll = emp.salaryPayroll || {}
    const struct = getSalaryStructure({
      ...payroll,
      monthlyCTC: payroll.monthlyCTC ?? payroll.ctc ?? emp.salary ?? 0,
    })
    const fields = salaryFormFromStructure(struct)
    setForm((f) => ({
      ...f,
      employee: emp._id,
      amount: fields.ctc,
      ...fields,
    }))
    setEmployeeSearch(emp.name || '')
    setEmployeeOpen(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => {
      if (name === 'amount' || name === 'ctc') {
        const struct = getSalaryStructure({ monthlyCTC: Number(value || 0), tds: f.tds })
        const fields = salaryFormFromStructure(struct)
        return {
          ...f,
          ...fields,
          amount: value,
          ctc: value,
          tds: f.tds,
          month: f.month,
          year: f.year,
          status: f.status,
          employee: f.employee,
        }
      }
      const next = {
        ...f,
        [name]: name === 'month' || name === 'year' ? Number(value) : value,
      }
      const earningKeys = ['basicSalary', 'da', 'hra', 'conveyance', 'medicalAllowance', 'employerPf']
      if (earningKeys.includes(name)) {
        const ctc = Number(next.ctc || next.amount || 0)
        const used =
          Number(next.basicSalary || 0) +
          Number(next.da || 0) +
          Number(next.hra || 0) +
          Number(next.conveyance || 0) +
          Number(next.medicalAllowance || 0) +
          Number(next.employerPf || 0)
        next.specialAllowance = Math.max(0, Math.round(ctc - used))
      }
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.employee) {
      setError('Please select an employee')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/salaries', {
        employee: form.employee,
        amount: Number(form.ctc || form.amount),
        month: form.month,
        year: form.year,
        status: form.status,
        ...salaryInputFromForm(form),
      })
      navigate('/salaries')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error creating salary record')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-1 block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'

  return (
    <div className='p-8 w-full'>
      <h1 className='text-2xl font-bold mb-4'>Add Salary Record</h1>
      <form
        className='w-full space-y-4 bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-sm'
        onSubmit={handleSubmit}
      >
        <div className='w-full'>
          <label className='block text-sm font-medium text-gray-700'>Employee</label>
          <div className='relative' ref={employeeRef}>
            <input
              type='text'
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value)
                setEmployeeOpen(true)
                if (!e.target.value) setForm((f) => ({ ...f, employee: '', amount: '', ctc: '' }))
              }}
              onFocus={() => setEmployeeOpen(true)}
              placeholder='Search employee...'
              className={inputClass}
              autoComplete='off'
            />
            {employeeOpen && (
              <ul className='absolute z-10 top-full left-0 right-0 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-300 rounded-xl shadow-lg py-1'>
                {filteredEmployees.length === 0 ? (
                  <li className='px-3 py-2 text-sm text-gray-500'>No employees found</li>
                ) : (
                  filteredEmployees.map((emp) => (
                    <li
                      key={emp._id}
                      onClick={() => handleEmployeeSelect(emp)}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.employee === emp._id ? 'bg-blue-100' : ''}`}
                    >
                      {emp.name} {emp.salary ? `(₹${Number(emp.salary).toLocaleString('en-IN')}/mo)` : ''}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div className='w-full'>
          <label className='block text-sm font-medium text-gray-700'>Monthly CTC</label>
          <input
            name='ctc'
            type='number'
            min='0'
            value={form.ctc}
            onChange={handleChange}
            required
            placeholder='Enter monthly CTC'
            className={inputClass}
          />
          {selectedEmployee && (
            <p className='text-xs text-gray-500 mt-1'>Filled from {selectedEmployee.name}&apos;s payroll. Edit CTC or any line for this month.</p>
          )}
        </div>

        {(() => {
          const preview = getSalaryStructure(salaryInputFromForm(form))
          const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
          return (
            <div className='w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-4'>
              <h3 className='font-bold text-gray-900 text-sm'>Earnings</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                {[
                  ['basicSalary', 'Basic Salary'],
                  ['da', 'Dearness Allowance'],
                  ['hra', 'House Rent Allowance'],
                  ['conveyance', 'Conveyance Allowance'],
                  ['specialAllowance', 'Special Allowance'],
                  ['employerPf', 'Employer PF Contribution'],
                  ['medicalAllowance', 'Medical Allowance'],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label className='block text-xs font-medium text-gray-700 mb-1'>{label}</label>
                    <input name={name} type='number' min='0' value={form[name]} onChange={handleChange} className={inputClass} />
                  </div>
                ))}
              </div>
              <h3 className='font-bold text-gray-900 text-sm'>Deductions</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                {[
                  ['employeePf', 'Employee PF'],
                  ['pt', 'Professional Tax'],
                  ['tds', 'Income Tax (TDS)'],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label className='block text-xs font-medium text-gray-700 mb-1'>{label}</label>
                    <input name={name} type='number' min='0' value={form[name]} onChange={handleChange} className={inputClass} />
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-3 gap-2 pt-1 border-t border-gray-200'>
                <div className='p-2 bg-green-50 rounded-lg border border-green-200'>
                  <span className='text-green-700 block font-medium'>Net Salary</span>
                  <span className='font-bold text-green-900 text-sm'>{money(preview.netSalary)}</span>
                </div>
                <div className='p-2 bg-blue-50 rounded-lg border border-blue-200'>
                  <span className='text-blue-700 block font-medium'>Gross Salary</span>
                  <span className='font-bold text-blue-900 text-sm'>{money(preview.grossSalary)}</span>
                </div>
                <div className='p-2 bg-purple-50 rounded-lg border border-purple-200'>
                  <span className='text-purple-700 block font-medium'>Annual CTC</span>
                  <span className='font-bold text-purple-900 text-sm'>{money(preview.annualCTC)}</span>
                </div>
              </div>
            </div>
          )
        })()}

        <div className='w-full grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700'>Month</label>
            <select name='month' value={form.month} onChange={handleChange} required className={inputClass}>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700'>Year</label>
            <input name='year' type='number' value={form.year} onChange={handleChange} required className={inputClass} />
          </div>
        </div>

        <div className='w-full'>
          <label className='block text-sm font-medium text-gray-700'>Status</label>
          <select name='status' value={form.status} onChange={handleChange} className={inputClass}>
            <option value='Unpaid'>Unpaid</option>
            <option value='Paid'>Paid</option>
          </select>
        </div>

        {error && <p className='text-red-600 text-sm w-full text-center rounded-lg bg-red-50 py-2 px-3'>{error}</p>}

        <div className='flex items-center justify-center gap-3 pt-2'>
          <button
            type='submit'
            disabled={loading}
            className='bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50'
          >
            {loading ? 'Saving...' : 'Save Salary'}
          </button>
          <button
            type='button'
            onClick={() => navigate('/salaries')}
            className='px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddSalary
