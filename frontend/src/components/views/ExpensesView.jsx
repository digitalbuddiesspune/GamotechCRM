import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate } from 'react-router-dom'

const ExpensesView = () => {
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const res = await api.get('/expenses')
      setExpenses(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || 'Error fetching expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting expense')
    }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatINR = (num) => {
    if (num == null || num === '' || isNaN(num)) return '—'
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Other Expenses</h1>
          <p className='text-gray-600 mt-1 text-sm'>Track expenses for revenue calculation.</p>
        </div>
        <button
          onClick={() => navigate('/add-expense')}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
        >
          Add Expense
        </button>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : (
        <div className='bg-white rounded-xl shadow border border-gray-200 overflow-hidden'>
          <table className='w-full table-auto text-sm'>
            <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
              <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Date</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Description</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Category</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Amount</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className='px-4 py-12 text-center text-gray-500'>
                    No expenses yet. Add expenses to include them in revenue calculation.
                  </td>
                </tr>
              ) : (
                [...expenses]
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
                      <td className='px-4 py-3 flex items-center gap-2'>
                        <button
                          onClick={() => navigate(`/expenses/edit/${e._id}`)}
                          className='text-blue-600 hover:text-blue-800 text-sm font-medium'
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(e._id)}
                          className='text-red-600 hover:text-red-800 text-sm font-medium'
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ExpensesView
