// Barrel для модуля auth. Постепенно новые компоненты/хуки ссылаются на
// features/auth/..., а не на плоские пути.
export { useAuth } from '../../hooks/index.js'
export { authApi } from '../../api/index.js'
