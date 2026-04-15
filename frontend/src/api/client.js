import axios from 'axios'

const client = axios.create({
  baseURL: '/',
  withCredentials: true,
})

// Глобальное состояние refresh-потока: гарантируем ровно один refresh на
// несколько параллельных 401 ответов. Остальные ждут в очереди.
let refreshPromise = null

function doRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/auth/refresh', {}, { withCredentials: true })
      .finally(() => {
        // Обнуляем только после завершения, чтобы следующая волна 401 стартанула новый refresh.
        refreshPromise = null
      })
  }
  return refreshPromise
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {}

    const isAuthCall = original.url?.includes('/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        await doRefresh()
        return client(original)
      } catch (refreshError) {
        // Единый путь провала: очищаем клиентское состояние и шлём на /login.
        // Избегаем петли если мы уже на /login.
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default client
