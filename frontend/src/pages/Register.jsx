import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/index.js'
import { useQueryClient } from '@tanstack/react-query'

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [touched, setTouched]   = useState({})

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwValid    = password.length >= 6
  const pw2Valid   = password2 === password

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ email: true, password: true, password2: true })
    if (!emailValid || !pwValid || !pw2Valid) return

    setError(null)
    setLoading(true)
    try {
      await authApi.register(email, password)
      const loginRes = await authApi.login(email, password)
      queryClient.setQueryData(['auth', 'me'], loginRes.data.user)
      navigate(params.get('from') || '/dashboard', { replace: true })
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Нет соединения с сервером. Проверьте интернет и попробуйте снова.')
      } else if (err.response?.status === 429) {
        setError('Слишком много попыток. Попробуйте через час.')
      } else {
        setError(err.response?.data?.detail || 'Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ paddingTop: 72, paddingBottom: 96, minHeight: 'calc(100vh - 68px)' }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="kicker" style={{ marginBottom: 14 }}>— регистрация</div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          Создайте <span className="hl">аккаунт</span>.
        </h1>
        <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 480 }}>
          Email и пароль — больше ничего не нужно. Займёт 30 секунд.
        </p>

        <form onSubmit={handleSubmit} noValidate className="card" style={{ marginTop: 36, padding: '32px 28px' }}>
          <div className="mono tiny muted" style={{ marginBottom: 4 }}>REGISTER</div>
          <div className="serif" style={{ fontSize: 30, letterSpacing: '-0.02em', marginBottom: 22 }}>Создать аккаунт</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label" htmlFor="reg-email">e-mail</label>
              <input
                id="reg-email"
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
              <label className="label" htmlFor="reg-password">пароль</label>
              <input
                id="reg-password"
                className="input"
                type="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
              {touched.password && !pwValid && (
                <div className="mono tiny" style={{ color: 'var(--accent)', marginTop: 6 }}>Минимум 6 символов</div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="reg-password2">пароль ещё раз</label>
              <input
                id="reg-password2"
                className="input"
                type="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password2: true }))}
              />
              {touched.password2 && !pw2Valid && (
                <div className="mono tiny" style={{ color: 'var(--accent)', marginTop: 6 }}>Пароли не совпадают</div>
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
            {loading ? <><span className="spin" /> Регистрация…</> : <>Зарегистрироваться <span className="arrow">→</span></>}
          </button>

          <div className="mono tiny muted" style={{ marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
            Нажимая «Зарегистрироваться», принимаете{' '}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--accent)', borderBottom: 0 }}>оферту</a>.<br />
            Уже есть аккаунт?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', borderBottom: 0 }}>войти</Link>
          </div>
        </form>
      </div>
    </section>
  )
}
