import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5011/api/v1/gamotechSolution',
})

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('crm_user')
    const token = raw ? JSON.parse(raw)?.token : ''
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    // ignore unreadable session
  }
  return config
})

export default api
