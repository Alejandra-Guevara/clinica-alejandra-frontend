import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((config) => {
  const csrf = document.cookie.split('; ').find((part) => part.startsWith('ca_csrf='))?.split('=')[1]
  if (csrf && !['get', 'head', 'options'].includes(config.method?.toLowerCase())) config.headers['X-CSRF-Token'] = decodeURIComponent(csrf)
  return config
})
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !window.location.pathname.endsWith('/login')) window.dispatchEvent(new Event('session-expired'))
  return Promise.reject(error)
})
export const getData = (promise) => promise.then((response) => response.data)
export default api
