import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/index.js'
import { useQueryClient } from '@tanstack/react-query'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      queryClient.setQueryData(['auth', 'me'], res.data.user)
      navigate(params.get('from') || '/dashboard', { replace: true })
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Нет соединения с сервером. Проверьте интернет и попробуйте снова.')
      } else if (err.response?.status === 429) {
        setError('Слишком много попыток. Попробуйте через пару минут.')
      } else {
        setError(err.response?.data?.detail || 'Неверный email или пароль')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      {/* Фоновое свечение */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(217,119,6,0.14) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Логотип */}
        <Link
          to="/"
          className="flex items-center justify-center gap-2.5 mb-8 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          aria-label="Tezis — на главную"
        >
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-900/50 group-hover:bg-brand-500 transition-colors duration-200">
            T
          </div>
          <span className="text-white font-semibold text-base">Tezis</span>
        </Link>

        {/* Карточка */}
        <div className="card rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1 text-center" style={{ textWrap: 'balance' }}>
            Добро пожаловать
          </h1>
          <p className="text-[#7A7362] text-sm text-center mb-7">Войдите в свой аккаунт</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-[#B8AE97]">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck="false"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com…"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F0E0B] border border-[#2E2820] text-white placeholder-[#7A7362] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 transition-colors duration-150"
              />
            </div>

            {/* Пароль */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-[#B8AE97]">
                Пароль
              </label>
              <input
                id="login-password"
                type="password"
                name="current-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F0E0B] border border-[#2E2820] text-white placeholder-[#7A7362] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 transition-colors duration-150"
              />
            </div>

            {/* Ошибка */}
            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1712]"
            >
              {loading && (
                <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#7A7362] mt-5">
          Нет аккаунта?{' '}
          <Link
            to="/register"
            className="text-brand-400 hover:text-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
