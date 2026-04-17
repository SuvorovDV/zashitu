import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../api/index.js'
import { useAuth } from '../../hooks/index.js'
import { useWizardStore } from '../../store/index.js'

function Logo() {
  return (
    <Link
      to="/"
      aria-label="Tezis — на главную"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: 0, color: 'var(--ink)',
        fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '-0.01em',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent)', color: 'var(--accent-ink)',
          borderRadius: 8,
          fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
          transform: 'rotate(-6deg)',
        }}
      >
        T
      </span>
      Tezis
    </Link>
  )
}

function NavLink({ label, to, active, onClick }) {
  const common = {
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-3)',
    border: 0, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: active ? 500 : 400,
    textDecoration: 'none',
  }
  if (onClick) return <button onClick={onClick} style={common}>{label}</button>
  return <Link to={to} style={common}>{label}</Link>
}

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const resetWizard = useWizardStore((s) => s.reset)

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  function handleNewOrder() {
    resetWizard()
    navigate('/wizard')
  }

  async function handleLogout() {
    try {
      await authApi.logout()
    } catch (e) {
      console.warn('logout request failed:', e)
    }
    queryClient.removeQueries({ queryKey: ['auth', 'me'] })
    queryClient.clear()
    navigate('/login')
  }

  return (
    <header
      style={{
        borderBottom: '1px solid var(--rule)',
        background: 'rgba(14, 14, 12, 0.82)',
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'saturate(140%) blur(10px)',
        WebkitBackdropFilter: 'saturate(140%) blur(10px)',
      }}
    >
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Logo />

          {user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <NavLink label="Дашборд" to="/dashboard" active={isActive('/dashboard')} />
              <NavLink label="Создать"  onClick={handleNewOrder} active={isActive('/wizard')} />
            </nav>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user ? (
            <>
              <div
                className="mono tiny muted"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--surface-2)', border: '1px solid var(--rule)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink)', fontSize: 11, fontFamily: 'var(--sans)', fontWeight: 600,
                  }}
                >
                  {(user.email || 'T').charAt(0).toUpperCase()}
                </span>
                {user.email}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-text" style={{ fontSize: 14 }}>Войти</Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Создать презентацию <span className="arrow">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
