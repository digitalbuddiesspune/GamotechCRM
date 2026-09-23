export const STATUS_OPTIONS = ['All', 'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled']

export const STATUS_COLORS = {
  'In Progress': { badge: 'bg-blue-100 text-blue-700', chart: '#3b82f6' },
  Completed: { badge: 'bg-green-100 text-green-700', chart: '#10b981' },
  'On Hold': { badge: 'bg-orange-100 text-orange-700', chart: '#f59e0b' },
  Cancelled: { badge: 'bg-red-100 text-red-700', chart: '#ef4444' },
  'Not Started': { badge: 'bg-gray-100 text-gray-700', chart: '#9ca3af' },
}

export const formatINR = (amount) => {
  if (amount == null || amount === '') return '—'
  return `₹ ${Number(amount).toLocaleString('en-IN')}`
}

export const formatDeadline = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const getDeadlineClass = (date, status) => {
  if (!date || status === 'Completed' || status === 'Cancelled') return 'text-gray-600'
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'text-red-600 font-semibold'
  if (diff <= 7) return 'text-orange-600 font-medium'
  return 'text-green-600'
}

export const getProjectCode = (project, index = 0) => {
  const year = project.createdAt ? new Date(project.createdAt).getFullYear() : new Date().getFullYear()
  const seq = String(index + 1).padStart(3, '0')
  return `PRJ-${year}-${seq}`
}

export const getClientName = (project) => {
  if (!project?.client) return '—'
  if (typeof project.client === 'object') return project.client.clientName || '—'
  return '—'
}

export const getClientId = (project) => {
  if (!project?.client) return null
  if (typeof project.client === 'object') return String(project.client._id)
  return String(project.client)
}

export const getTeamList = (project) => {
  const members = []
  const seen = new Set()
  const add = (person) => {
    if (!person) return
    const id = typeof person === 'object' ? person._id : person
    const key = String(id)
    if (!id || seen.has(key)) return
    seen.add(key)
    members.push(typeof person === 'object' ? person : { _id: person, name: 'Member' })
  }
  add(project.projectManager)
  ;(project.teamMembers || []).forEach(add)
  return members
}

export const getProjectStats = (projects) => {
  const total = projects.length
  const inProgress = projects.filter((p) => p.status === 'In Progress').length
  const completed = projects.filter((p) => p.status === 'Completed').length
  const onHold = projects.filter((p) => p.status === 'On Hold').length
  const cancelled = projects.filter((p) => p.status === 'Cancelled').length
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0)

  const now = new Date()
  const thisMonth = projects.filter((p) => {
    if (!p.createdAt) return false
    const d = new Date(p.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = projects.filter((p) => {
    if (!p.createdAt) return false
    const d = new Date(p.createdAt)
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear()
  }).length
  const growth = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0

  return { total, inProgress, completed, onHold, cancelled, pct, growth, thisMonth }
}

export const getStatusChartData = (projects) => {
  const counts = {}
  projects.forEach((p) => {
    const s = p.status || 'Not Started'
    counts[s] = (counts[s] || 0) + 1
  })
  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name]?.chart || '#9ca3af',
  }))
}

export const getUpcomingDeadlines = (projects, limit = 4) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return projects
    .filter((p) => {
      const d = p.deadline || p.endDate
      if (!d || p.status === 'Completed' || p.status === 'Cancelled') return false
      return new Date(d) >= today
    })
    .sort((a, b) => new Date(a.deadline || a.endDate) - new Date(b.deadline || b.endDate))
    .slice(0, limit)
}

export const getTopClients = (projects, limit = 5) => {
  const map = new Map()
  projects.forEach((p) => {
    const id = getClientId(p)
    const name = getClientName(p)
    if (!id || name === '—') return
    const prev = map.get(id) || { id, name, count: 0 }
    prev.count += 1
    map.set(id, prev)
  })
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

export const exportProjectsCsv = (projects) => {
  const headers = ['Project', 'Client', 'Status', 'Progress', 'Deadline', 'Budget']
  const rows = projects.map((p) => [
    p.projectName,
    getClientName(p),
    p.status,
    `${p.progress ?? 0}%`,
    formatDeadline(p.deadline || p.endDate),
    p.budget ?? '',
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
