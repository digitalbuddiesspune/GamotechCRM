import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { isLateCheckIn } from '../../utils/attendanceLate'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTER_MONTHS = {
  1: [0, 1, 2],
  2: [3, 4, 5],
  3: [6, 7, 8],
  4: [9, 10, 11],
}
const PERIOD_OPTIONS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
]

const formatINR = (num) => {
  if (num == null || Number.isNaN(Number(num))) return '—'
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

const formatDate = (d) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const toDate = (value) => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const getBillingDate = (billing) => billing?.paymentDetails?.paymentDate || billing?.createdAt || null
const getExpenseDate = (expense) => expense?.date || expense?.createdAt || null
const getBillingAmount = (billing) => Number(billing?.paymentDetails?.amount) || 0
const getClientName = (billing) =>
  billing?.client?.clientName || billing?.clientName || 'Unknown client'
const getClientId = (billing) =>
  String(billing?.client?._id || billing?.client || billing?.clientName || 'unknown')

const getEmpId = (value) => String(value?._id || value || '')
const getDesignation = (emp) =>
  emp?.designation?.title || emp?.designation?.name || emp?.designation || emp?.department || '—'

const dateInPeriod = (value, { year, periodType, month, quarter }) => {
  const d = toDate(value)
  if (!d || d.getFullYear() !== year) return false
  if (periodType === 'yearly') return true
  if (periodType === 'monthly') return d.getMonth() === month
  return QUARTER_MONTHS[quarter].includes(d.getMonth())
}

const monthInPeriod = (monthNumber, { year, periodType, month, quarter }) => {
  // monthNumber is 1-12 from salary records
  const m = Number(monthNumber)
  if (!m || m < 1 || m > 12) return false
  if (periodType === 'yearly') return true
  if (periodType === 'monthly') return m === month + 1
  return QUARTER_MONTHS[quarter].includes(m - 1)
}

const anyDateInPeriod = (dates, period) => dates.some((d) => dateInPeriod(d, period))

const MoneyCard = ({ title, value, subtitle, valueClass = 'text-gray-900' }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
    <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>{title}</h2>
    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>₹{formatINR(value)}</p>
    {subtitle && <p className='text-sm text-gray-500 mt-1'>{subtitle}</p>}
  </div>
)

const CountCard = ({ title, value, subtitle, valueClass = 'text-gray-900' }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
    <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>{title}</h2>
    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    {subtitle && <p className='text-sm text-gray-500 mt-1'>{subtitle}</p>}
  </div>
)

const ReportsView = () => {
  const navigate = useNavigate()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [reportTab, setReportTab] = useState('finance')
  const [billings, setBillings] = useState([])
  const [expenses, setExpenses] = useState([])
  const [salaries, setSalaries] = useState([])
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [leaves, setLeaves] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodType, setPeriodType] = useState('yearly')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()) // 0-based
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)

  const period = useMemo(
    () => ({
      year: selectedYear,
      periodType,
      month: selectedMonth,
      quarter: selectedQuarter,
    }),
    [selectedYear, periodType, selectedMonth, selectedQuarter]
  )

  const periodLabel = useMemo(() => {
    if (periodType === 'monthly') return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
    if (periodType === 'quarterly') return `Q${selectedQuarter} ${selectedYear}`
    return `Year ${selectedYear}`
  }, [periodType, selectedMonth, selectedQuarter, selectedYear])

  const monthsInPeriod = useMemo(() => {
    if (periodType === 'monthly') return [selectedMonth]
    if (periodType === 'quarterly') return QUARTER_MONTHS[selectedQuarter]
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  }, [periodType, selectedMonth, selectedQuarter])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const monthsToFetch = Array.from({ length: 12 }, (_, i) => {
          const m = String(i + 1).padStart(2, '0')
          return `${selectedYear}-${m}`
        })

        const [
          billingsRes,
          expensesRes,
          salariesRes,
          employeesRes,
          tasksRes,
          leavesRes,
          ...attendanceResList
        ] = await Promise.all([
          api.get('/billing'),
          api.get('/expenses').catch(() => ({ data: [] })),
          api.get('/salaries').catch(() => ({ data: [] })),
          api.get('/employees').catch(() => ({ data: [] })),
          api.get('/tasks').catch(() => ({ data: [] })),
          api.get('/leave').catch(() => ({ data: [] })),
          ...monthsToFetch.map((month) =>
            api.get('/attendance/by-month', { params: { month } }).catch(() => ({ data: [] }))
          ),
        ])

        setBillings(Array.isArray(billingsRes.data) ? billingsRes.data : [])
        setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : expensesRes.data?.data || [])
        const salaryPayload = salariesRes.data
        const salaryList = Array.isArray(salaryPayload)
          ? salaryPayload
          : salaryPayload?.data || salaryPayload?.salaries || []
        setSalaries(Array.isArray(salaryList) ? salaryList : [])

        const empList = Array.isArray(employeesRes.data)
          ? employeesRes.data
          : employeesRes.data?.data || []
        setEmployees(Array.isArray(empList) ? empList : [])

        const taskList = Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data?.data || []
        setTasks(Array.isArray(taskList) ? taskList : [])

        const leaveList = Array.isArray(leavesRes.data) ? leavesRes.data : leavesRes.data?.data || []
        setLeaves(Array.isArray(leaveList) ? leaveList : [])

        const att = attendanceResList.flatMap((res) =>
          Array.isArray(res.data) ? res.data : []
        )
        setAttendance(att)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error loading reports')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedYear])

  const yearOptions = useMemo(() => {
    const years = new Set([currentYear])
    billings.forEach((b) => {
      const d = toDate(getBillingDate(b))
      if (d) years.add(d.getFullYear())
    })
    expenses.forEach((e) => {
      const d = toDate(getExpenseDate(e))
      if (d) years.add(d.getFullYear())
    })
    salaries.forEach((s) => {
      if (s.year) years.add(Number(s.year))
    })
    return [...years].filter((y) => !Number.isNaN(y)).sort((a, b) => b - a)
  }, [billings, expenses, salaries, currentYear])

  const periodBillings = useMemo(
    () => billings.filter((b) => dateInPeriod(getBillingDate(b), period)),
    [billings, period]
  )

  const periodExpenses = useMemo(
    () => expenses.filter((e) => dateInPeriod(getExpenseDate(e), period)),
    [expenses, period]
  )

  const periodSalaries = useMemo(
    () =>
      salaries.filter(
        (s) => Number(s.year) === selectedYear && monthInPeriod(s.month, period)
      ),
    [salaries, selectedYear, period]
  )

  const periodLeaves = useMemo(
    () =>
      leaves.filter((l) =>
        anyDateInPeriod([l.startDate, l.endDate, l.createdAt], period)
      ),
    [leaves, period]
  )

  const periodTasks = useMemo(
    () =>
      tasks.filter((t) =>
        anyDateInPeriod([t.createdAt, t.dueDate, t.completedAt, t.updatedAt], period)
      ),
    [tasks, period]
  )

  const periodAttendance = useMemo(
    () => attendance.filter((a) => dateInPeriod(a.date || a.checkIn, period)),
    [attendance, period]
  )

  const totalRevenue = periodBillings.reduce((sum, b) => sum + getBillingAmount(b), 0)
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalPayroll = periodSalaries.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const netAmount = totalRevenue - totalExpenses - totalPayroll

  const activeEmployees = employees.filter(
    (e) => String(e.status || 'Active').toLowerCase() !== 'inactive'
  ).length
  const pendingLeaves = periodLeaves.filter((l) => l.status === 'Pending').length
  const approvedLeaves = periodLeaves.filter((l) => l.status === 'Approved').length
  const completedTasks = periodTasks.filter((t) => t.status === 'Completed').length
  const openTasks = periodTasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled').length
  const presentDays = periodAttendance.filter((a) => a.checkIn).length
  const lateDays = periodAttendance.filter((a) => a.checkIn && isLateCheckIn(a.checkIn)).length

  const revenueByClient = useMemo(() => {
    const map = {}
    periodBillings.forEach((b) => {
      const amount = getBillingAmount(b)
      if (amount <= 0) return
      const id = getClientId(b)
      if (!map[id]) map[id] = { id, client: getClientName(b), amount: 0, payments: 0 }
      map[id].amount += amount
      map[id].payments += 1
    })
    const rows = Object.values(map).sort((a, b) => b.amount - a.amount)
    const max = rows[0]?.amount || 0
    return rows.map((row) => ({
      ...row,
      percentage: max > 0 ? Math.round((row.amount / max) * 100) : 0,
      share: totalRevenue > 0 ? Math.round((row.amount / totalRevenue) * 100) : 0,
    }))
  }, [periodBillings, totalRevenue])

  const financeTrend = useMemo(() => {
    return monthsInPeriod.map((monthIndex) => {
      const revenue = periodBillings.reduce((sum, b) => {
        const d = toDate(getBillingDate(b))
        return d && d.getMonth() === monthIndex ? sum + getBillingAmount(b) : sum
      }, 0)
      const expense = periodExpenses.reduce((sum, e) => {
        const d = toDate(getExpenseDate(e))
        return d && d.getMonth() === monthIndex ? sum + (Number(e.amount) || 0) : sum
      }, 0)
      const payroll = periodSalaries.reduce((sum, s) => {
        return Number(s.month) === monthIndex + 1 ? sum + (Number(s.amount) || 0) : sum
      }, 0)
      return {
        month: MONTH_NAMES[monthIndex],
        revenue,
        expenses: expense,
        payroll,
        net: revenue - expense - payroll,
      }
    })
  }, [monthsInPeriod, periodBillings, periodExpenses, periodSalaries])

  const employeeTrend = useMemo(() => {
    return monthsInPeriod.map((monthIndex) => {
      const present = periodAttendance.reduce((sum, a) => {
        const d = toDate(a.date || a.checkIn)
        return d && d.getMonth() === monthIndex && a.checkIn ? sum + 1 : sum
      }, 0)
      const late = periodAttendance.reduce((sum, a) => {
        const d = toDate(a.date || a.checkIn)
        return d && d.getMonth() === monthIndex && a.checkIn && isLateCheckIn(a.checkIn) ? sum + 1 : sum
      }, 0)
      const leaveCount = periodLeaves.reduce((sum, l) => {
        const d = toDate(l.startDate || l.createdAt)
        return d && d.getMonth() === monthIndex ? sum + 1 : sum
      }, 0)
      const tasksDone = periodTasks.reduce((sum, t) => {
        const d = toDate(t.completedAt || t.updatedAt || t.createdAt)
        return d && d.getMonth() === monthIndex && t.status === 'Completed' ? sum + 1 : sum
      }, 0)
      return { month: MONTH_NAMES[monthIndex], present, late, leave: leaveCount, tasksCompleted: tasksDone }
    })
  }, [monthsInPeriod, periodAttendance, periodLeaves, periodTasks])

  const expenseByCategory = useMemo(() => {
    const map = {}
    periodExpenses.forEach((e) => {
      const key = e.category || 'Other'
      map[key] = (map[key] || 0) + (Number(e.amount) || 0)
    })
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [periodExpenses])

  const employeeRows = useMemo(() => {
    return employees
      .map((emp) => {
        const id = getEmpId(emp)
        const empAttendance = periodAttendance.filter((a) => getEmpId(a.employee) === id)
        const present = empAttendance.filter((a) => a.checkIn).length
        const late = empAttendance.filter((a) => a.checkIn && isLateCheckIn(a.checkIn)).length
        const empTasks = periodTasks.filter((t) => getEmpId(t.assignedTo) === id)
        const done = empTasks.filter((t) => t.status === 'Completed').length
        const empLeaves = periodLeaves.filter((l) => getEmpId(l.employee) === id)
        const approvedLeave = empLeaves.filter((l) => l.status === 'Approved').length
        const payroll = periodSalaries
          .filter((s) => getEmpId(s.employee) === id)
          .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
        return {
          id,
          name: emp.name || '—',
          designation: getDesignation(emp),
          status: emp.status || 'Active',
          present,
          late,
          tasks: empTasks.length,
          tasksDone: done,
          leaves: approvedLeave,
          payroll,
        }
      })
      .sort((a, b) => b.present - a.present || a.name.localeCompare(b.name))
  }, [employees, periodAttendance, periodTasks, periodLeaves, periodSalaries])

  return (
    <div className='p-4 md:p-5'>
      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Reports</h1>
          <p className='text-gray-600 text-sm mt-1'>
            Monthly, quarterly, and yearly finance & employee reports.
          </p>
        </div>
      </div>

      <div className='mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
        <div className='flex flex-wrap items-end gap-3'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Report Type</label>
            <div className='flex gap-1 bg-gray-100 rounded-lg p-1'>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type='button'
                  onClick={() => setPeriodType(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    periodType === opt.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[110px]'
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {periodType === 'monthly' && (
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]'
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'quarterly' && (
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]'
              >
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </select>
            </div>
          )}

          <div className='ml-auto self-center'>
            <span className='inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100'>
              Showing: {periodLabel}
            </span>
          </div>
        </div>
      </div>

      <div className='mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3'>
        <button
          type='button'
          onClick={() => setReportTab('finance')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            reportTab === 'finance'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Finance Reports
        </button>
        <button
          type='button'
          onClick={() => setReportTab('employees')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            reportTab === 'employees'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Employee Reports
        </button>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading reports...</p>
      ) : reportTab === 'finance' ? (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
            <MoneyCard title='Revenue Generated' value={totalRevenue} subtitle={`${periodBillings.filter((b) => getBillingAmount(b) > 0).length} payment(s) · ${periodLabel}`} valueClass='text-emerald-700' />
            <MoneyCard title='Payroll Salaries' value={totalPayroll} subtitle={`${periodSalaries.length} salary record(s)`} valueClass='text-amber-700' />
            <MoneyCard title='Other Expenses' value={totalExpenses} subtitle={`${periodExpenses.length} expense(s)`} valueClass='text-red-700' />
            <MoneyCard title='Net' value={netAmount} subtitle='Revenue − Payroll − Expenses' valueClass={netAmount >= 0 ? 'text-blue-700' : 'text-red-700'} />
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-lg font-bold text-gray-900'>Revenue by Client</h2>
                <span className='text-xs text-gray-500'>{periodLabel}</span>
              </div>
              {revenueByClient.length === 0 ? (
                <p className='text-sm text-gray-500 py-8 text-center'>No client payments found for this period.</p>
              ) : (
                <div className='space-y-4 max-h-96 overflow-y-auto pr-1'>
                  {revenueByClient.map((item) => (
                    <div key={item.id}>
                      <div className='flex justify-between mb-1 gap-3'>
                        <span className='text-sm font-medium text-gray-700 truncate'>{item.client}</span>
                        <span className='text-sm font-bold text-gray-900 whitespace-nowrap'>
                          ₹{formatINR(item.amount)}
                          <span className='text-xs font-normal text-gray-400 ml-1'>({item.share}%)</span>
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2'>
                        <div className='bg-blue-600 h-2 rounded-full' style={{ width: `${Math.max(item.percentage, 4)}%` }} />
                      </div>
                      <p className='text-[11px] text-gray-400 mt-1'>{item.payments} payment(s)</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-lg font-bold text-gray-900'>Expense by Category</h2>
                <button type='button' onClick={() => navigate('/expenses')} className='text-xs font-medium text-blue-600 hover:underline'>View all</button>
              </div>
              {expenseByCategory.length === 0 ? (
                <p className='text-sm text-gray-500 py-8 text-center'>No other expenses found for this period.</p>
              ) : (
                <div className='space-y-3 max-h-96 overflow-y-auto'>
                  {expenseByCategory.map((item) => (
                    <div key={item.category} className='flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100'>
                      <span className='text-sm font-medium text-gray-800'>{item.category}</span>
                      <span className='text-sm font-bold text-red-700'>₹{formatINR(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6'>
            <h2 className='text-lg font-bold text-gray-900 mb-1'>
              {periodType === 'monthly' ? 'Month Snapshot' : periodType === 'quarterly' ? 'Quarterly Trend' : 'Monthly Performance Trend'}
            </h2>
            <p className='text-xs text-gray-500 mb-4'>Revenue, other expenses, and payroll salaries · {periodLabel}</p>
            <div className='h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <ComposedChart data={financeTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                  <XAxis dataKey='month' tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                  <Tooltip formatter={(value, name) => [`₹${formatINR(value)}`, name]} contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey='revenue' name='Revenue' fill='#3b82f6' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='expenses' name='Other Expenses' fill='#ef4444' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='payroll' name='Payroll' fill='#f59e0b' radius={[4, 4, 0, 0]} />
                  <Line type='monotone' dataKey='net' name='Net' stroke='#10b981' strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between'>
                <div>
                  <h2 className='text-sm font-semibold text-gray-800'>Other Expenses</h2>
                  <p className='text-xs text-gray-500'>Total: ₹{formatINR(totalExpenses)} · {periodLabel}</p>
                </div>
                <button type='button' onClick={() => navigate('/expenses')} className='text-xs font-medium text-blue-600 hover:underline'>Manage</button>
              </div>
              <div className='overflow-x-auto max-h-80'>
                <table className='w-full table-auto text-sm'>
                  <thead className='sticky top-0'>
                    <tr className='bg-blue-600 text-white'>
                      <th className='px-4 py-3 text-left font-bold'>Date</th>
                      <th className='px-4 py-3 text-left font-bold'>Description</th>
                      <th className='px-4 py-3 text-left font-bold'>Category</th>
                      <th className='px-4 py-3 text-right font-bold'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodExpenses.length === 0 ? (
                      <tr><td colSpan={4} className='px-4 py-8 text-center text-gray-500'>No expenses in {periodLabel}.</td></tr>
                    ) : (
                      [...periodExpenses]
                        .sort((a, b) => new Date(getExpenseDate(b)) - new Date(getExpenseDate(a)))
                        .map((e) => (
                          <tr key={e._id} className='border-b hover:bg-gray-50'>
                            <td className='px-4 py-3 text-gray-700'>{formatDate(getExpenseDate(e))}</td>
                            <td className='px-4 py-3 font-medium'>{e.description || '—'}</td>
                            <td className='px-4 py-3'><span className='inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700'>{e.category || 'Other'}</span></td>
                            <td className='px-4 py-3 text-right font-semibold text-red-700'>₹{formatINR(e.amount)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between'>
                <div>
                  <h2 className='text-sm font-semibold text-gray-800'>Payroll Salaries</h2>
                  <p className='text-xs text-gray-500'>Total: ₹{formatINR(totalPayroll)} · {periodLabel}</p>
                </div>
                <button type='button' onClick={() => navigate('/salaries')} className='text-xs font-medium text-blue-600 hover:underline'>Manage</button>
              </div>
              <div className='overflow-x-auto max-h-80'>
                <table className='w-full table-auto text-sm'>
                  <thead className='sticky top-0'>
                    <tr className='bg-blue-600 text-white'>
                      <th className='px-4 py-3 text-left font-bold'>Employee</th>
                      <th className='px-4 py-3 text-left font-bold'>Month</th>
                      <th className='px-4 py-3 text-left font-bold'>Status</th>
                      <th className='px-4 py-3 text-right font-bold'>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodSalaries.length === 0 ? (
                      <tr><td colSpan={4} className='px-4 py-8 text-center text-gray-500'>No salary records in {periodLabel}.</td></tr>
                    ) : (
                      [...periodSalaries]
                        .sort((a, b) => (Number(b.month) || 0) - (Number(a.month) || 0))
                        .map((s) => (
                          <tr key={s._id} className='border-b hover:bg-gray-50'>
                            <td className='px-4 py-3 font-medium'>{s.employee?.name || '—'}</td>
                            <td className='px-4 py-3'>{s.month ? MONTH_SHORT[s.month] : '—'} {s.year || ''}</td>
                            <td className='px-4 py-3'>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(s.status || 'Unpaid') === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {s.status || 'Unpaid'}
                              </span>
                            </td>
                            <td className='px-4 py-3 text-right font-semibold text-amber-700'>₹{formatINR(s.amount)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6'>
            <CountCard title='Employees' value={employees.length} subtitle={`${activeEmployees} active`} />
            <CountCard title='Present Days' value={presentDays} subtitle={periodLabel} valueClass='text-emerald-700' />
            <CountCard title='Late Days' value={lateDays} subtitle='After grace period' valueClass='text-amber-700' />
            <CountCard title='Approved Leave' value={approvedLeaves} subtitle={`${pendingLeaves} pending`} valueClass='text-violet-700' />
            <CountCard title='Tasks Done' value={completedTasks} subtitle={`${openTasks} open`} valueClass='text-blue-700' />
            <CountCard title='Payroll' value={`₹${formatINR(totalPayroll)}`} subtitle={`${periodSalaries.length} records`} valueClass='text-amber-700' />
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6'>
            <h2 className='text-lg font-bold text-gray-900 mb-1'>Employee Performance Trend</h2>
            <p className='text-xs text-gray-500 mb-4'>Attendance, leave, and completed tasks · {periodLabel}</p>
            <div className='h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <ComposedChart data={employeeTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                  <XAxis dataKey='month' tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey='present' name='Present Days' fill='#10b981' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='late' name='Late Days' fill='#f59e0b' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='leave' name='Leave Apps' fill='#8b5cf6' radius={[4, 4, 0, 0]} />
                  <Line type='monotone' dataKey='tasksCompleted' name='Tasks Completed' stroke='#3b82f6' strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6'>
            <div className='px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between'>
              <div>
                <h2 className='text-sm font-semibold text-gray-800'>Employee Performance</h2>
                <p className='text-xs text-gray-500'>Attendance, tasks, leave & payroll · {periodLabel}</p>
              </div>
              <button type='button' onClick={() => navigate('/employees')} className='text-xs font-medium text-blue-600 hover:underline'>Directory</button>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full table-auto text-sm'>
                <thead>
                  <tr className='bg-blue-600 text-white'>
                    <th className='px-4 py-3 text-left font-bold'>Employee</th>
                    <th className='px-4 py-3 text-left font-bold'>Designation</th>
                    <th className='px-4 py-3 text-right font-bold'>Present</th>
                    <th className='px-4 py-3 text-right font-bold'>Late</th>
                    <th className='px-4 py-3 text-right font-bold'>Tasks</th>
                    <th className='px-4 py-3 text-right font-bold'>Done</th>
                    <th className='px-4 py-3 text-right font-bold'>Leave</th>
                    <th className='px-4 py-3 text-right font-bold'>Payroll</th>
                    <th className='px-4 py-3 text-left font-bold'>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.length === 0 ? (
                    <tr><td colSpan={9} className='px-4 py-10 text-center text-gray-500'>No employees found.</td></tr>
                  ) : (
                    employeeRows.map((row) => (
                      <tr key={row.id} className='border-b hover:bg-gray-50'>
                        <td className='px-4 py-3 font-medium text-gray-900'>{row.name}</td>
                        <td className='px-4 py-3 text-gray-600'>{row.designation}</td>
                        <td className='px-4 py-3 text-right text-emerald-700 font-semibold'>{row.present}</td>
                        <td className='px-4 py-3 text-right text-amber-700'>{row.late}</td>
                        <td className='px-4 py-3 text-right'>{row.tasks}</td>
                        <td className='px-4 py-3 text-right text-blue-700 font-semibold'>{row.tasksDone}</td>
                        <td className='px-4 py-3 text-right text-violet-700'>{row.leaves}</td>
                        <td className='px-4 py-3 text-right font-semibold'>₹{formatINR(row.payroll)}</td>
                        <td className='px-4 py-3'>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            String(row.status).toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between'>
                <h2 className='text-sm font-semibold text-gray-800'>Leave Applications</h2>
                <button type='button' onClick={() => navigate('/leave')} className='text-xs font-medium text-blue-600 hover:underline'>Manage</button>
              </div>
              <div className='overflow-x-auto max-h-80'>
                <table className='w-full table-auto text-sm'>
                  <thead className='sticky top-0'>
                    <tr className='bg-blue-600 text-white'>
                      <th className='px-4 py-3 text-left font-bold'>Employee</th>
                      <th className='px-4 py-3 text-left font-bold'>From</th>
                      <th className='px-4 py-3 text-left font-bold'>To</th>
                      <th className='px-4 py-3 text-left font-bold'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodLeaves.length === 0 ? (
                      <tr><td colSpan={4} className='px-4 py-8 text-center text-gray-500'>No leave records in {periodLabel}.</td></tr>
                    ) : (
                      [...periodLeaves]
                        .sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt))
                        .map((l) => (
                          <tr key={l._id} className='border-b hover:bg-gray-50'>
                            <td className='px-4 py-3 font-medium'>{l.employee?.name || '—'}</td>
                            <td className='px-4 py-3'>{formatDate(l.startDate)}</td>
                            <td className='px-4 py-3'>{formatDate(l.endDate)}</td>
                            <td className='px-4 py-3'>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                l.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : l.status === 'Rejected'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}>
                                {l.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between'>
                <h2 className='text-sm font-semibold text-gray-800'>Task Status Snapshot</h2>
                <button type='button' onClick={() => navigate('/tasks')} className='text-xs font-medium text-blue-600 hover:underline'>Manage</button>
              </div>
              <div className='overflow-x-auto max-h-80'>
                <table className='w-full table-auto text-sm'>
                  <thead className='sticky top-0'>
                    <tr className='bg-blue-600 text-white'>
                      <th className='px-4 py-3 text-left font-bold'>Task</th>
                      <th className='px-4 py-3 text-left font-bold'>Assignee</th>
                      <th className='px-4 py-3 text-left font-bold'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodTasks.length === 0 ? (
                      <tr><td colSpan={3} className='px-4 py-8 text-center text-gray-500'>No tasks in {periodLabel}.</td></tr>
                    ) : (
                      [...periodTasks]
                        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                        .slice(0, 50)
                        .map((t) => (
                          <tr key={t._id} className='border-b hover:bg-gray-50'>
                            <td className='px-4 py-3 font-medium'>{t.title || '—'}</td>
                            <td className='px-4 py-3'>{t.assignedTo?.name || '—'}</td>
                            <td className='px-4 py-3'>
                              <span className='inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700'>
                                {t.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ReportsView
