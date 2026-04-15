import { useQuery } from '@tanstack/react-query'
import { authApi, generationApi } from '../api/index.js'
import client from '../api/client.js'

/**
 * Правда про DEV_MODE приходит с бэка (`/health`). VITE_DEV_MODE на фронте
 * мог рассинхронизироваться с рестартом бэка, поэтому дёргаем сервер.
 */
export function useDevMode() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => client.get('/health').then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  })
  return Boolean(data?.dev_mode)
}

export function useAuth() {
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me().then((r) => r.data),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
  }
}

export function useGenerationStatus(orderId) {
  return useQuery({
    queryKey: ['generation', orderId],
    queryFn: () => generationApi.getStatus(orderId).then((r) => r.data),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'done' || status === 'failed') return false
      // Exponential-ish backoff: короткий poll в начале, пореже — потом.
      // Генерация обычно 30–120с, незачем долбить 3с сотню раз.
      const count = query.state.dataUpdateCount || 0
      if (count < 6) return 2500       // первые ~15 с: быстро
      if (count < 18) return 5000      // следующая минута: 5 с
      return 10000                      // дальше — 10 с
    },
  })
}
