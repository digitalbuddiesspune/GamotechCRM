import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import { useNavigate, useParams } from 'react-router-dom'

const CATEGORIES = ['Office', 'Travel', 'Marketing', 'Software', 'Utilities', 'Rent', 'Other']

const AddExpense = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'Other',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isEdit && id) {
      api
        .get(`/expenses/${id}`)
        .then((res) => {
          const e = res.data
          setForm({
            description: e.description || '',
            amount: e.amount ?? '',
            date: e.date ? new Date(e.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            category: e.category || 'Other',
          })
        })
        .catch((err) => setError(err.response?.data?.message || 'Failed to load expense'))
    }
  }, [id, isEdit])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description?.trim()) {
      setError('Description is required')
      return
    }
    const amount = Number(form.amount)
    if (isNaN(amount) || amount < 0) {
      setError('Enter a valid amount')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await api.put(`/expenses/${id}`, {
          description: form.description.trim(),
          amount,
          date: form.date,
          category: form.category || 'Other',
        })
        navigate('/expenses')
      } else {
        await api.post('/expenses', {
          description: form.description.trim(),
          amount,
          date: form.date,
          category: form.category || 'Other',
        })
        navigate('/expenses')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error saving expense')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-1 block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className='p-8 w-full'>
      <h1 className='text-2xl font-bold text-gray-900 mb-2'>
        {isEdit ? 'Edit Expense' : 'Add Expense'}
      </h1>
      <p className='text-gray-600 text-sm mb-6'>
        {isEdit ? 'Update expense details.' : 'Record an expense for revenue calculation.'}
      </p>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700'>Description</label>
          <input
            type='text'
            name='description'
            value={form.description}
            onChange={handleChange}
            className={inputClass}
            placeholder='e.g. Office supplies'
            required
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>Amount (₹)</label>
          <input
            type='number'
            name='amount'
            value={form.amount}
            onChange={handleChange}
            className={inputClass}
            min={0}
            step={0.01}
            required
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>Date</label>
          <input
            type='date'
            name='date'
            value={form.date}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>Category</label>
          <select
            name='category'
            value={form.category}
            onChange={handleChange}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className='flex gap-3 pt-2'>
          <button
            type='submit'
            disabled={loading}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50'
          >
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Expense'}
          </button>
          <button
            type='button'
            onClick={() => navigate('/expenses')}
            className='border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium'
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddExpense
