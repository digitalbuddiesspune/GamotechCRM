import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5011/api/v1/gamotechSolution',
})

export default api
