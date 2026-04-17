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
  const [touched, setTouched]   = useState({})

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwValid    = password.length >= 6

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!emailValid || !pwValid) return

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
    <section style={{ paddingTop: 72, paddingBottom: 96, minHeight: 'calc(100vh - 68px)' }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="kicker" style={{ marginBottom: 14 }}>— вход</div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          <span className="hl">С возвращением</span>.
        </h1>
        <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 480 }}>
          Email и пароль — доступ к заказам и скачиванию .pptx в любой момент.
        </p>

        <form onSubmit={handleSubmit} noValidate className="card" style={{ marginTop: 36, padding: '32px 28px' }}>
          <div className="mono tiny muted" style={{ marginBottom: 4 }}>LOGIN</div>
          <div className="serif" style={{ fontSize: 30, letterSpacing: '-0.02em', marginBottom: 22 }}>Войти</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label" htmlFor="login-email">e-mail</label>
              <input
                id="login-email"
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck="false"
                placeholder="ivanov@university.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                autoFocus
              />
              {touched.email && !emailValid && (
                <div className="mono tiny" style={{ color: 'var(--accent)', marginTop: 6 }}>Введите корректный e-mail</div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="login-password">пароль</label>
              <input
                id="login-password"
                className="input"
                type="password"
                name="current-password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
              {touched.password && !pwValid && (
                <div className="mono tiny" style={{ color: 'var(--accent)', marginTop: 6 }}>Минимум 6 символов</div>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mono tiny"
              style={{ marginTop: 16, color: 'var(--err)', background: 'var(--err-wash)', border: '1px solid var(--err)', padding: '10px 14px', borderRadius: 10, textAlign: 'center' }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 22, width: '100%', justifyContent: 'center' }}>
            {loading ? <><span className="spin" /> Вход…</> : <>Войти <span className="arrow">→</span></>}
          </button>

          <div className="mono tiny muted" style={{ marginTop: 16, textAlign: 'center' }}>
            Нет аккаунта?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', borderBottom: 0 }}>создать</Link>
          </div>
        </form>
      </div>
    </section>
  )
}
