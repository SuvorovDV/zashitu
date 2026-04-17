import { useNavigate } from 'react-router-dom'
import Mascot from '../components/ui/Mascot.jsx'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <main>
      <section style={{ paddingTop: 80, paddingBottom: 120 }}>
        <div
          className="wrap"
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 60, alignItems: 'center' }}
        >
          <div>
            <div
              className="serif"
              style={{
                fontSize: 'clamp(140px, 20vw, 260px)',
                lineHeight: 0.85,
                letterSpacing: '-0.04em',
                margin: 0,
                color: 'var(--ink)',
              }}
            >
              4<span className="hl" style={{ padding: '0 4px' }}>0</span>4
            </div>
            <h1
              className="serif"
              style={{
                fontSize: 'clamp(30px, 3.5vw, 44px)',
                margin: '16px 0 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Этой страницы нет в источнике.
            </h1>
            <p
              style={{
                marginTop: 14,
                fontSize: 16.5,
                color: 'var(--ink-2)',
                maxWidth: 520,
              }}
            >
              Научрук бы сказал: «откуда взяли?». Давайте вернёмся туда, где всё на месте.
            </p>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                На дашборд <span className="arrow">→</span>
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/wizard')}>
                Создать презентацию
              </button>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Mascot size={180} state="verify" />
            <div
              className="hand"
              style={{
                position: 'absolute',
                right: -20, top: -20,
                fontSize: 24, color: 'var(--accent)',
                transform: 'rotate(-5deg)',
                width: 140, lineHeight: 1.1,
              }}
            >
              с. 404 не существует
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
