import React, { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { DeleteIcon, EditIcon } from '../Icons'

const ASSET_TYPES = ['Laptop', 'Desktop', 'Mobile Phone', 'SIM Card', 'Access Card', 'Monitor', 'Other']
const ASSET_STATUSES = ['Available', 'Assigned', 'Maintenance', 'Retired']

const statusStyles = {
  Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  Maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  Retired: 'bg-slate-100 text-slate-600 border-slate-200',
}

const getDesignationTitle = (employee) =>
  employee?.designation?.title || employee?.designation?.name || employee?.designation || employee?.department || '—'

const emptyForm = {
  name: '',
  assetType: 'Laptop',
  assetTag: '',
  serialNumber: '',
  brand: '',
  model: '',
  status: 'Available',
  purchaseDate: '',
  warrantyExpiry: '',
  notes: '',
  assignedTo: '',
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const StatCard = ({ title, value, icon, iconBg }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500'>{title}</p>
        <p className='text-2xl font-bold text-gray-900 mt-1'>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const StatusBadge = ({ status }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[status] || statusStyles.Retired}`}>
    {status}
  </span>
)

const Field = ({ label, children }) => (
  <label className='block'>
    <span className='text-sm font-medium text-gray-700'>{label}</span>
    <div className='mt-1'>{children}</div>
  </label>
)

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

const AssetsModuleView = () => {
  const [assets, setAssets] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [assignAsset, setAssignAsset] = useState(null)
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.assetType = typeFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const res = await api.get('/assets', { params })
      setAssets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, searchQuery])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/employees')
      const payload = res.data
      setEmployees(Array.isArray(payload) ? payload : payload?.data || [])
    } catch {
      setEmployees([])
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    const timer = setTimeout(() => fetchAssets(), 200)
    return () => clearTimeout(timer)
  }, [fetchAssets])

  const stats = useMemo(() => ({
    total: assets.length,
    available: assets.filter((a) => a.status === 'Available').length,
    assigned: assets.filter((a) => a.status === 'Assigned').length,
    maintenance: assets.filter((a) => a.status === 'Maintenance').length,
  }), [assets])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (asset) => {
    setEditingId(asset._id)
    setForm({
      name: asset.name || '',
      assetType: asset.assetType || 'Other',
      assetTag: asset.assetTag || '',
      serialNumber: asset.serialNumber || '',
      brand: asset.brand || '',
      model: asset.model || '',
      status: asset.status || 'Available',
      purchaseDate: asset.purchaseDate ? String(asset.purchaseDate).split('T')[0] : '',
      warrantyExpiry: asset.warrantyExpiry ? String(asset.warrantyExpiry).split('T')[0] : '',
      notes: asset.notes || '',
      assignedTo: asset.assignedTo?._id || asset.assignedTo || '',
    })
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Asset name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        assignedTo: form.assignedTo || null,
      }
      if (editingId) {
        await api.put(`/assets/${editingId}`, payload)
      } else {
        await api.post('/assets', payload)
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      fetchAssets()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save asset')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this asset?')) return
    try {
      await api.delete(`/assets/${id}`)
      fetchAssets()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete asset')
    }
  }

  const openAssign = (asset) => {
    setAssignAsset(asset)
    setAssignEmployeeId(asset.assignedTo?._id || asset.assignedTo || '')
  }

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!assignAsset?._id) return
    setAssigning(true)
    setError('')
    try {
      await api.patch(`/assets/${assignAsset._id}/assign`, {
        employeeId: assignEmployeeId || null,
      })
      setAssignAsset(null)
      setAssignEmployeeId('')
      fetchAssets()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to assign asset')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className='min-h-full bg-[#f4f6f8]'>
      <div className='px-6 md:px-8 py-6 border-b border-gray-200 bg-white'>
        <nav className='text-sm text-gray-500 mb-2'>
          <span className='text-gray-900 font-medium'>Employees</span>
          <span className='mx-2 text-gray-300'>›</span>
          <span className='text-gray-900 font-medium'>Assets</span>
        </nav>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Assets</h1>
            <p className='text-sm text-gray-500 mt-1'>Manage company assets and assign them to employees.</p>
          </div>
          <button
            type='button'
            onClick={openCreate}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700'
          >
            <span className='text-lg leading-none'>+</span>
            Add Asset
          </button>
        </div>
      </div>

      <div className='p-6 md:px-8 md:py-6 space-y-6'>
        {error && (
          <div className='px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800'>{error}</div>
        )}

        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <StatCard title='Total Assets' value={stats.total} icon='📦' iconBg='bg-blue-100 text-blue-600' />
          <StatCard title='Available' value={stats.available} icon='✓' iconBg='bg-emerald-100 text-emerald-600' />
          <StatCard title='Assigned' value={stats.assigned} icon='👤' iconBg='bg-violet-100 text-violet-600' />
          <StatCard title='Maintenance' value={stats.maintenance} icon='🔧' iconBg='bg-amber-100 text-amber-600' />
        </div>

        <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
          <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2'>
            <input
              type='search'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by name, tag, serial…'
              className='flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm'
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className='border border-gray-200 rounded-lg px-3 py-2 text-sm'>
              <option value=''>All Types</option>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className='border border-gray-200 rounded-lg px-3 py-2 text-sm'>
              <option value=''>All Status</option>
              {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase'>
                  <th className='px-5 py-3'>Asset</th>
                  <th className='px-5 py-3'>Type</th>
                  <th className='px-5 py-3'>Tag / Serial</th>
                  <th className='px-5 py-3'>Assigned To</th>
                  <th className='px-5 py-3'>Assigned On</th>
                  <th className='px-5 py-3'>Status</th>
                  <th className='px-5 py-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {loading ? (
                  <tr><td colSpan={7} className='px-5 py-12 text-center text-gray-500'>Loading assets…</td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={7} className='px-5 py-12 text-center text-gray-500'>No assets found. Add your first asset.</td></tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset._id} className='hover:bg-gray-50/80'>
                      <td className='px-5 py-3'>
                        <p className='font-medium text-gray-900'>{asset.name}</p>
                        <p className='text-xs text-gray-400'>{[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}</p>
                      </td>
                      <td className='px-5 py-3 text-gray-700'>{asset.assetType}</td>
                      <td className='px-5 py-3 text-gray-600 font-mono text-xs'>
                        <p>{asset.assetTag || '—'}</p>
                        {asset.serialNumber && <p className='text-gray-400 mt-0.5'>{asset.serialNumber}</p>}
                      </td>
                      <td className='px-5 py-3'>
                        {asset.assignedTo?.name ? (
                          <div>
                            <p className='font-medium text-gray-900'>{asset.assignedTo.name}</p>
                            <p className='text-xs text-gray-400'>{getDesignationTitle(asset.assignedTo)}</p>
                          </div>
                        ) : (
                          <span className='text-gray-400'>Unassigned</span>
                        )}
                      </td>
                      <td className='px-5 py-3 text-gray-600 whitespace-nowrap'>{formatDate(asset.assignedAt)}</td>
                      <td className='px-5 py-3'><StatusBadge status={asset.status} /></td>
                      <td className='px-5 py-3'>
                        <div className='flex items-center justify-end gap-1'>
                          <button
                            type='button'
                            onClick={() => openAssign(asset)}
                            className='px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50'
                          >
                            Assign
                          </button>
                          <button type='button' onClick={() => openEdit(asset)} className='p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50' title='Edit'>
                            <EditIcon />
                          </button>
                          <button type='button' onClick={() => handleDelete(asset._id)} className='p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50' title='Delete'>
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40'>
          <div className='bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto'>
            <div className='px-6 py-4 border-b border-gray-100'>
              <h2 className='text-lg font-semibold text-gray-900'>{editingId ? 'Edit Asset' : 'Add Asset'}</h2>
            </div>
            <form onSubmit={handleSave} className='p-6 space-y-4'>
              <Field label='Asset Name *'>
                <input name='name' value={form.name} onChange={handleFormChange} className={inputClass} required />
              </Field>
              <div className='grid grid-cols-2 gap-4'>
                <Field label='Type'>
                  <select name='assetType' value={form.assetType} onChange={handleFormChange} className={inputClass}>
                    {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label='Status'>
                  <select name='status' value={form.status} onChange={handleFormChange} className={inputClass}>
                    {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <Field label='Asset Tag'>
                  <input name='assetTag' value={form.assetTag} onChange={handleFormChange} className={inputClass} placeholder='AST-001' />
                </Field>
                <Field label='Serial Number'>
                  <input name='serialNumber' value={form.serialNumber} onChange={handleFormChange} className={inputClass} />
                </Field>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <Field label='Brand'>
                  <input name='brand' value={form.brand} onChange={handleFormChange} className={inputClass} />
                </Field>
                <Field label='Model'>
                  <input name='model' value={form.model} onChange={handleFormChange} className={inputClass} />
                </Field>
              </div>
              <Field label='Assign to Employee'>
                <select name='assignedTo' value={form.assignedTo} onChange={handleFormChange} className={inputClass}>
                  <option value=''>— Unassigned —</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}{getDesignationTitle(emp) !== '—' ? ` · ${getDesignationTitle(emp)}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <div className='grid grid-cols-2 gap-4'>
                <Field label='Purchase Date'>
                  <input type='date' name='purchaseDate' value={form.purchaseDate} onChange={handleFormChange} className={inputClass} />
                </Field>
                <Field label='Warranty Expiry'>
                  <input type='date' name='warrantyExpiry' value={form.warrantyExpiry} onChange={handleFormChange} className={inputClass} />
                </Field>
              </div>
              <Field label='Notes'>
                <textarea name='notes' value={form.notes} onChange={handleFormChange} rows={3} className={inputClass} />
              </Field>
              <div className='flex justify-end gap-2 pt-2'>
                <button type='button' onClick={() => setShowForm(false)} className='px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50'>
                  Cancel
                </button>
                <button type='submit' disabled={saving} className='px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'>
                  {saving ? 'Saving…' : editingId ? 'Update Asset' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignAsset && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40'>
          <div className='bg-white rounded-xl shadow-xl w-full max-w-md'>
            <div className='px-6 py-4 border-b border-gray-100'>
              <h2 className='text-lg font-semibold text-gray-900'>Assign Asset</h2>
              <p className='text-sm text-gray-500 mt-1'>{assignAsset.name}</p>
            </div>
            <form onSubmit={handleAssign} className='p-6 space-y-4'>
              <Field label='Employee'>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className={inputClass}
                >
                  <option value=''>— Unassign —</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}{getDesignationTitle(emp) !== '—' ? ` · ${getDesignationTitle(emp)}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <div className='flex justify-end gap-2'>
                <button type='button' onClick={() => setAssignAsset(null)} className='px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50'>
                  Cancel
                </button>
                <button type='submit' disabled={assigning} className='px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'>
                  {assigning ? 'Saving…' : assignEmployeeId ? 'Assign' : 'Unassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetsModuleView
