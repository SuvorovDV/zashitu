import { Link, useLocation } from 'react-router-dom'
import { authApi } from '../../api/index.js'
import { useAuth } from '../../hooks/index.js'
import { useWizardStore } from '../../store/index.js'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const resetWizard = useWizardStore((s) => s.reset)
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  function handleNewOrder() {
    // Сброс черновика — иначе в визард подтягиваются старые ответы.
    resetWizard()
    navigate('/wizard')
  }

  async function handleLogout() {
    try {
      await authApi.logout()
    } catch (e) {
      // Сервер может быть недоступен или сессия уже истекла — клиентский
      // logout всё равно важнее чем серверный ответ.
      console.warn('logout request failed:', e)
    }
    queryClient.removeQueries({ queryKey: ['auth', 'me'] })
    queryClient.clear()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#2E2820] bg-[#0F0E0B]/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Логотип */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          aria-label="Tezis — на главную"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-brand-900/50 group-hover:bg-brand-500 transition-colors duration-200">
            T
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Tezis</span>
        </Link>

        {/* Навигация */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                to="/dashboard"
                aria-current={isActive('/dashboard') ? 'page' : undefined}
                className={`text-sm transition-colors duration-150 px-3 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  isActive('/dashboard')
                    ? 'text-white bg-[#221E17]'
                    : 'text-[#B8AE97] hover:text-white hover:bg-[#221E17]'
                }`}
              >
                Мои заказы
              </Link>
              <button
                type="button"
                onClick={handleNewOrder}
                aria-current={isActive('/wizard') ? 'page' : undefined}
                className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition-colors duration-150 shadow-md shadow-brand-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                + Новая
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-[#7A7362] hover:text-[#B8AE97] transition-colors duration-150 px-3 py-2 rounded-lg hover:bg-[#221E17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-[#B8AE97] hover:text-white transition-colors duration-150 px-3 py-2 rounded-lg hover:bg-[#221E17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition-colors duration-150 shadow-md shadow-brand-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                Начать бесплатно
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
