import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate } from 'react-router-dom'

const getCurrentMonthRange = () => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: monthStart.toISOString().slice(0, 10),
    to: monthEnd.toISOString().slice(0, 10),
  }
}

const RevenueView = () => {
  const [billings, setBillings] = useState([])
  const [employees, setEmployees] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState(() => getCurrentMonthRange().from)
  const [dateTo, setDateTo] = useState(() => getCurrentMonthRange().to)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [billingsRes, employeesRes, expensesRes] = await Promise.all([
          api.get('/billing'),
          api.get('/employees').catch(() => ({ data: [] })),
          api.get('/expenses').catch(() => ({ data: [] })),
        ])
        setBillings(Array.isArray(billingsRes.data) ? billingsRes.data : [])
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : employeesRes.data?.data ?? [])
        setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : expensesRes.data?.data ?? [])
      } catch (err) {
        setError(err.message || 'Error fetching revenue data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getBillingDate = (billing) => billing?.paymentDetails?.paymentDate || billing?.createdAt || null
  const getExpenseDate = (expense) => expense?.date || expense?.createdAt || null

  const isWithinSelectedRange = (value) => {
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      if (date < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (date > to) return false
    }
    return true
  }

  const filteredBillings = billings.filter((b) => isWithinSelectedRange(getBillingDate(b)))
  const filteredExpenses = expenses.filter((e) => isWithinSelectedRange(getExpenseDate(e)))

  const totalRevenue = filteredBillings.reduce((sum, b) => sum + (Number(b.paymentDetails?.amount) || 0), 0)
  const totalSalaries = employees.reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0)
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const netAmount = totalRevenue - totalSalaries - totalExpenses

  const revenueEntries = filteredBillings
    .filter((b) => (Number(b.paymentDetails?.amount) || 0) > 0)
    .sort((a, b) => new Date(b.paymentDetails?.paymentDate || b.createdAt || 0) - new Date(a.paymentDetails?.paymentDate || a.createdAt || 0))

  const formatINR = (num) => {
    if (num == null || num === '' || isNaN(num)) return '—'
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  const formatDate = (d) => {
    if (!d) return '—'
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className='p-4 md:p-5'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>Revenue</h1>
        <p className='text-gray-600 text-sm mt-1'>All revenue from billing payments.</p>
      </div>

      <div className='mb-6 bg-white rounded-xl shadow border border-gray-200 p-4'>
        <div className='flex flex-wrap items-end gap-3'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>From</label>
            <input
              type='date'
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>To</label>
            <input
              type='date'
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <button
            type='button'
            onClick={() => {
              const currentMonth = getCurrentMonthRange()
              setDateFrom(currentMonth.from)
              setDateTo(currentMonth.to)
            }}
            className='px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50'
          >
            Current Month
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
            <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
              <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Total Revenue</h2>
              <p className='text-2xl font-bold text-gray-900 mt-1'>₹{formatINR(totalRevenue)}</p>
              <p className='text-sm text-gray-500 mt-1'>{revenueEntries.length} payment(s)</p>
            </div>
            <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
              <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Total Salaries</h2>
              <p className='text-2xl font-bold text-amber-700 mt-1'>₹{formatINR(totalSalaries)}</p>
              <p className='text-sm text-gray-500 mt-1'>{employees.length} employee(s)</p>
            </div>
            <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
              <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Other Expenses</h2>
              <p className='text-2xl font-bold text-red-700 mt-1'>₹{formatINR(totalExpenses)}</p>
              <p className='text-sm text-gray-500 mt-1'>{filteredExpenses.length} expense(s)</p>
            </div>
            <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
              <h2 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Net</h2>
              <p className={`text-2xl font-bold mt-1 ${netAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ₹{formatINR(netAmount)}
              </p>
              <p className='text-sm text-gray-500 mt-1'>Revenue − Salaries − Expenses</p>
            </div>
          </div>

          <div className='mb-6 bg-white rounded-xl shadow border border-gray-200 overflow-hidden'>
            <div className='px-4 py-3 border-b border-gray-200 bg-gray-50'>
              <h2 className='text-sm font-semibold text-gray-800'>Other expenses</h2>
              <p className='text-xs text-gray-500 mt-0.5'>Tracked for revenue calculation. Total: ₹{formatINR(totalExpenses)}</p>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full table-auto text-sm'>
                <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                  <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Date</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Description</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Category</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className='px-4 py-8 text-center text-gray-500'>
                        No other expenses found in selected range.
                      </td>
                    </tr>
                  ) : (
                    [...filteredExpenses]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((e) => (
                        <tr key={e._id} className='border-b hover:bg-gray-50'>
                          <td className='px-4 py-3 text-gray-700'>{formatDate(e.date)}</td>
                          <td className='px-4 py-3 font-medium'>{e.description || '—'}</td>
                          <td className='px-4 py-3'>
                            <span className='inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700'>
                              {e.category || 'Other'}
                            </span>
                          </td>
                          <td className='px-4 py-3 text-right font-semibold text-red-700'>₹{formatINR(e.amount)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className='bg-white rounded-xl shadow border border-gray-200 overflow-hidden'>
            <div className='px-4 py-3 border-b border-gray-200 bg-gray-50'>
              <h2 className='text-sm font-semibold text-gray-800'>All Revenue</h2>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full table-auto text-sm'>
                <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                  <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Date</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Invoice</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Client</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Type</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Amount</th>
                    <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className='px-4 py-10 text-center text-gray-500'>
                        No revenue records yet. Revenue appears when billings have payment amount.
                      </td>
                    </tr>
                  ) : (
                    revenueEntries.map((b) => (
                      <tr key={b._id} className='border-b hover:bg-gray-50'>
                        <td className='px-4 py-3 text-gray-700'>
                          {formatDate(b.paymentDetails?.paymentDate || b.createdAt)}
                        </td>
                        <td className='px-4 py-3 font-medium'>{b.invoiceNumber || '—'}</td>
                        <td className='px-4 py-3'>{b.client?.clientName || '—'}</td>
                        <td className='px-4 py-3'>
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              b.billType === 'GST' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {b.billType}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-right font-semibold text-gray-900'>
                          ₹{formatINR(b.paymentDetails?.amount)}
                        </td>
                        <td className='px-4 py-3'>
                          <button
                            onClick={() => navigate(`/billings/${b._id}/invoice`)}
                            className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-600 text-green-700 text-sm font-medium hover:bg-green-50'
                          >
                            View Invoice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RevenueView
