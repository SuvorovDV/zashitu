import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '../api/index.js'
import { useAuth } from '../hooks/index.js'
import Spinner from '../components/ui/Spinner.jsx'
import Mascot from '../components/ui/Mascot.jsx'

/* ─── Hero ───────────────────────────────────────────────────────────────── */

function Stat({ big, small }) {
  return (
    <div>
      <div className="serif" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em' }}>{big}</div>
      <div className="mono tiny muted" style={{ marginTop: 8 }}>{small}</div>
    </div>
  )
}

function HeroDiagram() {
  return (
    <div style={{ position: 'relative', paddingTop: 4 }} aria-hidden>
      <div style={{ position: 'absolute', right: -8, top: -40, zIndex: 2 }}>
        <Mascot size={110} state="verify" />
        <div
          className="hand"
          style={{ position: 'absolute', left: -90, top: 40, fontSize: 22, color: 'var(--ink-2)', transform: 'rotate(-4deg)', width: 120, lineHeight: 1.1 }}
        >
          откуда цифра?
        </div>
        <svg style={{ position: 'absolute', left: 0, top: 60, overflow: 'visible' }} width="80" height="40">
          <path d="M 4 10 C 20 30, 40 28, 66 18" fill="none" stroke="var(--ink-2)" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M 60 14 L 68 18 L 62 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="card" style={{ padding: 24, position: 'relative' }}>
        <div className="mono tiny muted" style={{ marginBottom: 10 }}>preview · диплом_иванов.pdf → .pptx</div>
        <svg viewBox="0 0 420 280" width="100%" height="auto">
          <g transform="translate(8,20)">
            <rect x="0" y="0" width="160" height="220" fill="var(--surface-2)" stroke="var(--rule-strong)" rx="6" />
            {Array.from({ length: 11 }).map((_, i) => (
              <rect key={i} x="16" y={22 + i * 16} width={i % 3 === 2 ? 64 : 128} height="3" fill="rgba(245,243,236,0.35)" rx="1.5" />
            ))}
            <rect x="12" y="116" width="136" height="14" fill="var(--accent)" opacity="0.25" rx="2" />
            <text x="16" y="208" fontFamily="var(--mono)" fontSize="9" fill="var(--ink-3)">с. 47</text>
          </g>
          <g>
            <path d="M 180 140 C 210 100, 230 180, 258 140" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
            <path d="M 252 134 L 260 140 L 252 146" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g transform="translate(258,60)">
            <rect x="0" y="0" width="160" height="100" fill="var(--ink)" stroke="var(--ink)" rx="6" />
            <rect x="12" y="14" width="76" height="6" fill="var(--accent-ink)" rx="1" />
            <rect x="12" y="28" width="130" height="3" fill="rgba(14,14,12,0.6)" rx="1" />
            <rect x="12" y="38" width="110" height="3" fill="rgba(14,14,12,0.6)" rx="1" />
            <rect x="12" y="48" width="120" height="3" fill="rgba(14,14,12,0.6)" rx="1" />
            <text x="12" y="86" fontFamily="var(--mono)" fontSize="8" fill="var(--accent-ink)" fontWeight="600">с. 47</text>
          </g>
          <text x="258" y="186" fontFamily="var(--mono)" fontSize="10" fill="var(--ink-3)">slide 07 / 20</text>
          <text x="258" y="202" fontFamily="var(--mono)" fontSize="10" fill="var(--ink-3)">.pptx · редактируется</text>

          <text x="90" y="260" fontFamily="var(--hand)" fontSize="18" fill="var(--accent)" textAnchor="middle">подсвечен абзац-источник</text>
          <path d="M 78 244 Q 90 232 110 238" fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function Hero({ ctaHref }) {
  return (
    <section id="top" style={{ paddingTop: 96, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: -10, right: 40, transform: 'rotate(6deg)' }}>
          <span className="sticker">★ не ЗА вас пишет — из ВАШЕЙ работы</span>
        </div>

        <div className="kicker" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
          академический генератор презентаций · 2026
        </div>

        <h1
          className="serif"
          style={{ fontSize: 'clamp(52px, 7vw, 104px)', lineHeight: 0.98, margin: 0, letterSpacing: '-0.025em', textWrap: 'balance', maxWidth: 1100 }}
        >
          Защитите диплом с<br />
          презентацией, <span className="hl">которую не придумал ИИ</span>.
        </h1>

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 60, alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 640, textWrap: 'pretty', margin: 0 }}>
              Загружаешь PDF или DOCX — через 1–2 минуты получаешь <span style={{ color: 'var(--ink)', fontWeight: 500 }}>.pptx</span>, где каждый тезис со ссылкой на страницу источника. Редактируется в PowerPoint, Keynote и Google Slides.
            </p>

            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link to={ctaHref} className="btn btn-primary">Загрузить работу <span className="arrow">→</span></Link>
              <a className="btn btn-text" href="#process">Как это работает <span className="arrow">→</span></a>
            </div>

            <div style={{ marginTop: 48, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <Stat big="1–2 мин" small="от файла до .pptx" />
              <Stat big={<>0 <span className="hand" style={{ color: 'var(--accent)', fontSize: 36 }}>придумано</span></>} small="всё из вашего текста" />
              <Stat big="12–30" small="слайдов со ссылками" />
            </div>
          </div>

          <HeroDiagram />
        </div>
      </div>
    </section>
  )
}

/* ─── Upload ─────────────────────────────────────────────────────────────── */

function UploadSection({ ctaHref }) {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle')
  const inputRef = useRef(null)

  const onFiles = (files) => {
    const f = files && files[0]
    if (!f) return
    if (!/\.(pdf|docx)$/i.test(f.name)) { alert('Поддерживаются только PDF и DOCX'); return }
    setFile({ name: f.name, size: f.size })
    setPhase('uploading')
    setProgress(0)
  }

  useEffect(() => {
    if (phase !== 'uploading') return
    let p = 0
    const t = setInterval(() => {
      p += Math.random() * 12 + 6
      if (p >= 100) {
        clearInterval(t)
        setProgress(100)
        setTimeout(() => setPhase('ready'), 300)
      } else {
        setProgress(p)
      }
    }, 140)
    return () => clearInterval(t)
  }, [phase])

  const reset = () => {
    setFile(null)
    setProgress(0)
    setPhase('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section id="upload" style={{ paddingTop: 16, paddingBottom: 96 }}>
      <div className="wrap">
        <div
          className="card"
          style={{
            padding: '40px 40px',
            borderColor: drag ? 'var(--accent)' : 'var(--rule-strong)',
            background: drag ? 'var(--accent-wash)' : 'var(--surface)',
            borderStyle: phase === 'idle' ? 'dashed' : 'solid',
            transition: 'background .15s, border-color .15s',
          }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
        >
          {phase === 'idle' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
              <div>
                <div className="mono tiny muted">загрузка</div>
                <div className="serif" style={{ fontSize: 36, marginTop: 10, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Перетащи PDF или DOCX —<br />
                  <span className="hl">или выбери файл</span>
                </div>
                <div style={{ marginTop: 12, color: 'var(--ink-3)', fontSize: 14 }}>
                  До 200 страниц. Файл не хранится после генерации.
                </div>
              </div>
              <div>
                <input ref={inputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={(e) => onFiles(e.target.files)} />
                <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                  Выбрать файл <span className="arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {phase !== 'idle' && file && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 46, height: 58, border: '1px solid var(--accent)', background: 'var(--accent-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent)', borderRadius: 6 }}>
                  {/\.pdf$/i.test(file.name) ? 'PDF' : 'DOCX'}
                </div>
                <div>
                  <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{file.name}</div>
                  <div className="mono tiny muted" style={{ marginTop: 4 }}>
                    {(file.size / 1024).toFixed(0)} КБ
                    {phase === 'uploading' && <> · загрузка {Math.round(progress)}%</>}
                    {phase === 'ready' && <> · готов к обработке</>}
                  </div>
                </div>
                <div>
                  {phase === 'ready' ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-ghost" onClick={reset}>Другой файл</button>
                      <Link className="btn btn-primary" to={ctaHref}>Выбрать тариф <span className="arrow">→</span></Link>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" onClick={reset}>Отмена</button>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 18, height: 3, background: 'var(--rule)', position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: progress + '%', background: 'var(--accent)', transition: 'width .15s linear' }} />
              </div>
            </div>
          )}
        </div>

        <div className="mono tiny muted" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>поддерживается: .pdf, .docx · макс. 200 стр.</span>
          <span>файлы не хранятся на серверах</span>
        </div>
      </div>
    </section>
  )
}

/* ─── Specimen ───────────────────────────────────────────────────────────── */

function SectionHead({ num, kicker, title, lede }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 40, alignItems: 'baseline' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 150 }}>
        <div className="serif" style={{ fontSize: 44, color: 'var(--accent)', lineHeight: 0.9 }}>{num}</div>
        <div className="kicker">— {kicker}</div>
      </div>
      <div>
        <h2 className="serif" style={{ fontSize: 'clamp(36px, 4.5vw, 58px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05, textWrap: 'balance' }}>{title}</h2>
        {lede && <p style={{ maxWidth: 720, fontSize: 17.5, color: 'var(--ink-2)', marginTop: 18, textWrap: 'pretty' }}>{lede}</p>}
      </div>
    </div>
  )
}

function BrowserChrome({ children }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--rule)', background: 'var(--surface-2)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
        <div className="mono tiny muted" style={{ marginLeft: 14, flex: 1, padding: '4px 12px', borderRadius: 6, background: 'var(--bg)' }}>
          tezis.app / preview / slide-07
        </div>
      </div>
      {children}
    </div>
  )
}

const SPECIMEN_POINTS = [
  { t: 'Внедрение модели позволило сократить среднее время отклика сервиса на 34%',   src: 'с. 47' },
  { t: 'Совокупная экономия за пилотный квартал — 2,1 млн ₽ при CAC ниже на 18%',     src: 'с. 51' },
  { t: 'Дальнейшее масштабирование требует дообучения на 8 400 дополнительных примерах', src: 'с. 53' },
]
const SPECIMEN_LINES = [[5, 6, 7], [11, 12], [17, 18, 19]]

function SlideSpecimen({ activeIdx, onHover }) {
  return (
    <div style={{ aspectRatio: '16 / 9', padding: '32px 36px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--ink)', color: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="mono tiny" style={{ color: 'rgba(14,14,12,0.55)' }}>07 / Выводы</div>
        <div className="mono tiny" style={{ color: 'rgba(14,14,12,0.55)' }}>Иванов А.В. · ВКР 2026</div>
      </div>
      <div>
        <h3 className="serif" style={{ fontSize: 30, margin: '4px 0', letterSpacing: '-0.015em', lineHeight: 1.1, color: 'var(--bg)' }}>Выводы по главе 2</h3>
        <div style={{ width: 40, height: 2, background: 'var(--bg)' }} />
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SPECIMEN_POINTS.map((p, i) => (
          <li
            key={i}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onHover(i === activeIdx ? null : i)}
            style={{
              display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'start',
              padding: '8px 10px', cursor: 'pointer', borderRadius: 6,
              background: activeIdx === i ? 'rgba(200,255,62,0.35)' : 'transparent',
              transition: 'background .15s',
            }}
          >
            <span className="mono tiny" style={{ color: 'rgba(14,14,12,0.55)', paddingTop: 3 }}>0{i + 1}</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--bg)' }}>{p.t}</span>
            <span className="mono tiny" style={{ color: activeIdx === i ? 'var(--bg)' : 'rgba(14,14,12,0.45)', whiteSpace: 'nowrap', paddingTop: 3, fontWeight: 600 }}>{p.src}</span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(14,14,12,0.15)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span className="mono tiny" style={{ color: 'rgba(14,14,12,0.5)' }}>Tezis · источник: diplom_ivanov.pdf</span>
        <span className="mono tiny" style={{ color: 'rgba(14,14,12,0.5)' }}>7 / 20</span>
      </div>
    </div>
  )
}

function PdfPage({ highlight, pageLabel }) {
  const lines = Array.from({ length: 22 })
  return (
    <div style={{ border: '1px solid var(--rule-strong)', background: '#F6F2E6', padding: '32px 28px 24px', position: 'relative', aspectRatio: '3 / 4', borderRadius: 12, color: '#0E0E0C' }}>
      <div className="mono tiny" style={{ position: 'absolute', top: 14, right: 16, color: 'rgba(14,14,12,0.55)' }}>{pageLabel}</div>
      <div className="serif" style={{ fontSize: 14, marginBottom: 10, fontWeight: 500 }}>2.3 Результаты пилотного эксперимента</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {lines.map((_, i) => {
          const isHot = highlight && highlight.includes(i)
          const width = [94, 88, 96, 82, 78, 92, 86, 90, 84, 96][i % 10] + '%'
          return (
            <div key={i} style={{ position: 'relative', height: 6, width }}>
              {isHot && <div style={{ position: 'absolute', left: -4, right: -4, top: -3, bottom: -3, background: 'var(--accent)', opacity: 0.55, borderRadius: 2 }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.4)' }} />
            </div>
          )
        })}
      </div>
      <div className="mono tiny" style={{ position: 'absolute', bottom: 14, left: 28, color: 'rgba(14,14,12,0.45)' }}>{pageLabel.replace('с. ', '')}</div>
    </div>
  )
}

function Specimen() {
  const [hot, setHot] = useState(null)
  return (
    <section id="specimen" style={{ paddingTop: 88, paddingBottom: 96 }}>
      <div className="wrap">
        <SectionHead
          num="01"
          kicker="Пример"
          title={<>Посмотрите, что именно <span className="hl">вы получаете</span>.</>}
          lede="Каждый тезис на слайде помечен страницей источника. Наведите на пункт — и подсветится соответствующий абзац в PDF."
        />

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)', gap: 32, alignItems: 'start' }}>
          <div>
            <div className="mono tiny muted" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>источник · diplom_ivanov.pdf</span>
              <span style={{ color: hot !== null ? 'var(--accent)' : 'var(--ink-3)' }}>
                {hot === null ? 'наведите на тезис →' : SPECIMEN_POINTS[hot].src}
              </span>
            </div>
            <PdfPage highlight={hot !== null ? SPECIMEN_LINES[hot] : null} pageLabel={hot === null ? 'с. 47' : SPECIMEN_POINTS[hot].src} />
          </div>
          <div>
            <div className="mono tiny muted" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>результат · prezentatsiya.pptx · слайд 7/20</span>
              <span>редактируется в PowerPoint</span>
            </div>
            <BrowserChrome>
              <SlideSpecimen activeIdx={hot} onHover={setHot} />
            </BrowserChrome>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Modes ──────────────────────────────────────────────────────────────── */

function ModeCard({ active, tag, title, points }) {
  return (
    <div
      className="card"
      style={{
        padding: 28,
        background: active ? 'var(--surface-2)' : 'var(--surface)',
        borderColor: active ? 'var(--accent)' : 'var(--rule)',
        transition: 'background .2s, border-color .2s',
        position: 'relative',
      }}
    >
      {active && <div style={{ position: 'absolute', top: 16, right: 16, width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />}
      <div className="mono tiny" style={{ color: active ? 'var(--accent)' : 'var(--ink-3)' }}>{tag}</div>
      <div className="serif" style={{ fontSize: 32, marginTop: 10, letterSpacing: '-0.02em' }}>{title}</div>
      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
        {points.map((p, i) => (
          <li key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10 }}>
            <span style={{ color: active ? 'var(--accent)' : 'var(--ink-4)', fontWeight: 700 }}>·</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Modes() {
  const [mode, setMode] = useState('only')
  return (
    <section id="modes" style={{ paddingTop: 96, paddingBottom: 96, borderTop: '1px solid var(--rule)' }}>
      <div className="wrap">
        <SectionHead
          num="02"
          kicker="Режимы"
          title={<>Только слайды — или <span className="hl">со сценарием выступления</span>.</>}
          lede="Нужно защититься за 5 минут? Сгенерируем .pptx. Нужна полноценная речь на 5–15 минут со всеми ссылками? Добавим текст выступления."
        />

        <div style={{ marginTop: 36, display: 'inline-flex', padding: 4, border: '1px solid var(--rule-strong)', borderRadius: 999 }}>
          <button
            onClick={() => setMode('only')}
            style={{ padding: '9px 18px', border: 0, borderRadius: 999, background: mode === 'only' ? 'var(--accent)' : 'transparent', color: mode === 'only' ? 'var(--accent-ink)' : 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: mode === 'only' ? 600 : 500 }}
          >
            Только презентация
          </button>
          <button
            onClick={() => setMode('speech')}
            style={{ padding: '9px 18px', border: 0, borderRadius: 999, background: mode === 'speech' ? 'var(--accent)' : 'transparent', color: mode === 'speech' ? 'var(--accent-ink)' : 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: mode === 'speech' ? 600 : 500 }}
          >
            + текст выступления
          </button>
        </div>

        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ModeCard
            active={mode === 'only'}
            tag=".pptx"
            title="Только презентация"
            points={[
              '12, 20 или 30 слайдов',
              'ссылка на страницу на каждом слайде',
              'редактируется в PowerPoint / Keynote / Google Slides',
              'готово за 1–2 минуты',
            ]}
          />
          <ModeCard
            active={mode === 'speech'}
            tag=".pptx + .md"
            title="Презентация + речь"
            points={[
              'текст на 5–15 минут выступления',
              'помечены паузы и переходы между слайдами',
              'ссылки на страницы прямо в речи',
              'можно вставить в суфлёр или распечатать',
            ]}
          />
        </div>
      </div>
    </section>
  )
}

/* ─── Process ────────────────────────────────────────────────────────────── */

function ProcessDiagram({ step, active }) {
  const s = active ? 'var(--accent)' : 'var(--ink-3)'
  return (
    <svg viewBox="0 0 260 92" width="100%" height="100%">
      {step === 0 && (
        <g fill="none" stroke={s} strokeWidth="1.3">
          <rect x="10" y="12" width="54" height="68" rx="4" />
          <line x1="20" y1="26" x2="54" y2="26" />
          <line x1="20" y1="36" x2="48" y2="36" />
          <line x1="20" y1="46" x2="56" y2="46" />
          <line x1="20" y1="56" x2="42" y2="56" />
          <path d="M 80 46 Q 120 26 160 46" strokeDasharray="3 3" />
          <path d="M 154 42 L 162 46 L 154 50" />
          <text x="180" y="50" fontFamily="var(--mono)" fontSize="10" fill={s}>.pdf</text>
        </g>
      )}
      {step === 1 && (
        <g fill="none" stroke={s} strokeWidth="1.3">
          <rect x="10" y="12" width="54" height="68" rx="4" />
          {[24, 34, 44, 54, 64].map((y, i) => (
            <line key={i} x1="20" y1={y} x2={20 + (i % 2 ? 30 : 40)} y2={y} strokeOpacity={i === 2 ? 1 : 0.4} />
          ))}
          <rect x="16" y="40" width="44" height="8" fill={s} opacity="0.18" stroke="none" />
          <path d="M 80 46 L 130 46" strokeDasharray="3 3" />
          <text x="106" y="40" fontFamily="var(--mono)" fontSize="9" fill={s} textAnchor="middle">с. 47</text>
          <circle cx="160" cy="46" r="16" />
          <text x="160" y="50" fontFamily="var(--mono)" fontSize="11" fill={s} textAnchor="middle">AI</text>
        </g>
      )}
      {step === 2 && (
        <g fill="none" stroke={s} strokeWidth="1.3">
          <rect x="10" y="22" width="90" height="50" rx="4" />
          <line x1="20" y1="34" x2="54" y2="34" strokeWidth="2.2" />
          <line x1="20" y1="46" x2="86" y2="46" />
          <line x1="20" y1="56" x2="74" y2="56" />
          <text x="20" y="70" fontFamily="var(--mono)" fontSize="8" fill={s}>с. 47</text>
          <path d="M 116 46 L 166 46" />
          <path d="M 160 42 L 168 46 L 160 50" />
          <text x="200" y="44" fontFamily="var(--mono)" fontSize="11" fill={s} textAnchor="middle">.pptx</text>
          <text x="200" y="58" fontFamily="var(--mono)" fontSize="8" fill={s} textAnchor="middle" opacity="0.7">12–30 слайдов</text>
        </g>
      )}
    </svg>
  )
}

const PROCESS_STEPS = [
  { n: '01', t: 'Загружаешь работу',   d: 'PDF или DOCX. До 200 страниц. Один файл.' },
  { n: '02', t: 'ИИ собирает тезисы',  d: 'Только из твоего текста. Каждому тезису — страница источника.' },
  { n: '03', t: 'Скачиваешь .pptx',    d: '12–30 слайдов. Открывается везде: PowerPoint, Keynote, Google Slides.' },
]

function Process() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 3400)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="process" style={{ paddingTop: 96, paddingBottom: 96, borderTop: '1px solid var(--rule)' }}>
      <div className="wrap">
        <SectionHead num="03" kicker="Процесс" title={<>Три шага — от файла до <span className="hl">готовой защиты</span>.</>} />

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {PROCESS_STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              onMouseEnter={() => setStep(i)}
              className="card"
              style={{
                textAlign: 'left', padding: '28px 24px 24px', cursor: 'pointer',
                background: step === i ? 'var(--surface-2)' : 'var(--surface)',
                borderColor: step === i ? 'var(--accent)' : 'var(--rule)',
                transition: 'background .2s, border-color .2s',
                fontFamily: 'inherit', color: 'inherit', borderBottom: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="serif" style={{ fontSize: 28, color: step === i ? 'var(--accent)' : 'var(--ink-3)', lineHeight: 1 }}>{s.n}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: step === i ? 'var(--accent)' : 'var(--rule-strong)' }} />
              </div>
              <div className="serif" style={{ fontSize: 26, marginTop: 18, letterSpacing: '-0.015em', lineHeight: 1.15 }}>{s.t}</div>
              <p style={{ marginTop: 8, fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 300 }}>{s.d}</p>
              <div style={{ marginTop: 18, height: 92 }}>
                <ProcessDiagram step={i} active={step === i} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features + Testimonials ────────────────────────────────────────────── */

const FEATURES = [
  { k: '01', t: 'Только ваш текст',    d: 'ИИ не добавляет факты и цифры извне. Если чего-то нет в источнике — этого не будет на слайде.' },
  { k: '02', t: 'Ссылка на страницу',  d: 'Каждый тезис помечен «с. N». Научрук откроет исходник и проверит за 10 секунд.' },
  { k: '03', t: 'Редактируемый .pptx', d: 'Не картинки, а настоящие слайды. Меняйте шрифты, цвета, порядок — всё останется.' },
  { k: '04', t: '1–2 минуты',          d: 'От загрузки файла до готовой презентации. Без очередей и ожиданий.' },
]

const TESTIMONIALS = [
  { name: 'Аня, ВКР · НИУ ВШЭ',        text: 'Научрук первым делом полезла в с. 47 — и там всё совпало. Защитилась на 5, претензий по цифрам ноль.', rotate: -1 },
  { name: 'Денис, курсовая · МГУ',     text: 'Перегонял 120-страничный диплом друга в презу для него — за 2 минуты. Он потом сам не поверил.',       rotate: 0.5 },
  { name: 'Марина, школа · 11 класс',  text: 'Проект по биологии. Учителя всегда спрашивают «откуда?» — теперь ссылка на странице прямо на слайде. Спорить не с чем.', rotate: -0.8 },
]

function Quote({ name, text, rotate }) {
  return (
    <div className="card" style={{ padding: 22, background: 'var(--surface)', transform: `rotate(${rotate}deg)` }}>
      <div className="serif" style={{ fontSize: 36, lineHeight: 0.7, color: 'var(--accent)' }}>“</div>
      <p style={{ margin: '6px 0 18px', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink)' }}>{text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
          {name.charAt(0)}
        </div>
        <div className="mono tiny muted">{name}</div>
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" style={{ paddingTop: 96, paddingBottom: 96, borderTop: '1px solid var(--rule)' }}>
      <div className="wrap">
        <SectionHead num="04" kicker="Источник — ваша работа" title={<>Почему Tezis — <span className="hl">не очередной</span> AI-генератор.</>} />

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {FEATURES.map((it) => (
            <div key={it.k} className="card" style={{ padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span className="serif" style={{ fontSize: 28, color: 'var(--accent)', lineHeight: 1 }}>{it.k}</span>
                <div className="serif" style={{ fontSize: 24, letterSpacing: '-0.015em' }}>{it.t}</div>
              </div>
              <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)' }}>{it.d}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 56 }}>
          <div className="kicker" style={{ marginBottom: 20 }}>— что говорят студенты</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {TESTIMONIALS.map((q) => <Quote key={q.name} {...q} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ────────────────────────────────────────────────────────────── */

const TIER_META = {
  basic:    { note: 'Для реферата и короткого доклада' },
  standard: { note: 'Оптимально для курсовой и диплома', popular: true },
  premium:  { note: 'Для ВКР, магистерской, конференции' },
}

function Li({ children }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 8 }}>
      <span className="mono" style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>
      <span>{children}</span>
    </li>
  )
}

function Pricing({ ctaHref }) {
  const [hovered, setHovered] = useState(1)
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['tiers'],
    queryFn: () => paymentsApi.getTiers().then((r) => r.data),
    staleTime: 60_000,
  })

  return (
    <section id="pricing" style={{ paddingTop: 96, paddingBottom: 96, borderTop: '1px solid var(--rule)' }}>
      <div className="wrap">
        <SectionHead
          num="05"
          kicker="Цены"
          title={<>Разовая оплата. <span className="hl">Без подписки</span>.</>}
          lede="Все тарифы включают ссылки на страницы, редактируемый .pptx и скачивание сразу после оплаты."
        />

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Spinner size="lg" /></div>
        ) : (
          <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {tiers && Object.values(tiers).map((t, i) => {
              const meta = TIER_META[t.id] || {}
              return (
                <div
                  key={t.id}
                  onMouseEnter={() => setHovered(i)}
                  className="card"
                  style={{
                    padding: '32px 28px 28px',
                    background: hovered === i ? 'var(--surface-2)' : 'var(--surface)',
                    borderColor: hovered === i ? 'var(--accent)' : 'var(--rule)',
                    transition: 'background .2s, border-color .2s, transform .2s',
                    transform: hovered === i ? 'translateY(-2px)' : 'none',
                    position: 'relative', cursor: 'pointer',
                  }}
                >
                  {meta.popular && (
                    <div style={{ position: 'absolute', top: -12, left: 24 }}>
                      <span className="sticker">★ популярный</span>
                    </div>
                  )}
                  <div className="mono tiny" style={{ color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>0{i + 1}</span>
                    <span>{t.slides} слайдов</span>
                  </div>
                  <div className="serif" style={{ fontSize: 36, marginTop: 14, letterSpacing: '-0.02em', lineHeight: 1 }}>{t.label}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-3)' }}>{meta.note}</div>

                  <div style={{ marginTop: 28, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div className="serif" style={{ fontSize: 52, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {new Intl.NumberFormat('ru-RU').format(t.price_rub)} ₽
                    </div>
                    <div className="mono tiny muted">разово</div>
                  </div>

                  <ul style={{ marginTop: 24, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5, color: 'var(--ink-2)' }}>
                    <Li><b style={{ fontWeight: 500, color: 'var(--ink)' }}>{t.slides} слайдов</b></Li>
                    <Li>{t.id === 'premium' ? 'Premium Claude-модель' : 'Стандартная Claude-модель'}</Li>
                    <Li>ссылки на страницы</Li>
                    <Li>редактируемый .pptx</Li>
                    <Li>генерация 1–2 минуты</Li>
                    {t.id === 'premium' && <Li>приоритетная очередь</Li>}
                  </ul>

                  <Link to={ctaHref} className={'btn ' + (meta.popular ? 'btn-primary' : 'btn-ghost')} style={{ marginTop: 28, width: '100%', justifyContent: 'center' }}>
                    Выбрать {t.label}
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        <div className="mono tiny muted" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>оплата через ЮKassa или Stripe · в Telegram-боте — Telegram Stars</span>
          <span>— все тарифы включают page-sourcing</span>
        </div>
      </div>
    </section>
  )
}

/* ─── CTA strip (replaces in-landing Auth) ───────────────────────────────── */

function CtaStrip({ user }) {
  return (
    <section id="auth" style={{ paddingTop: 96, paddingBottom: 96, borderTop: '1px solid var(--rule)' }}>
      <div className="wrap">
        <div className="card" style={{ padding: '40px 40px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }}>
          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>— начать сейчас</div>
            <div className="serif" style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {user ? <>С возвращением. <span className="hl">К делу.</span></> : <>Готовы защищаться <span className="hl">уверенно</span>?</>}
            </div>
            <p style={{ marginTop: 12, color: 'var(--ink-2)', fontSize: 16, maxWidth: 560 }}>
              {user
                ? 'Продолжайте там, где остановились — или создайте новую презентацию.'
                : 'Регистрация занимает 30 секунд. Email и пароль — всё, что нужно.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Link to="/dashboard" className="btn btn-ghost">Дашборд</Link>
                <Link to="/wizard" className="btn btn-primary">Создать <span className="arrow">→</span></Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Войти</Link>
                <Link to="/register" className="btn btn-primary">Создать аккаунт <span className="arrow">→</span></Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="mono tiny muted" style={{ marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
        {items.map(([l, h], i) => (
          <li key={i}><a href={h} style={{ color: 'var(--ink-2)', borderBottom: 0 }}>{l}</a></li>
        ))}
      </ul>
    </div>
  )
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--rule)', paddingTop: 56, paddingBottom: 40 }}>
      <div className="wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)', transform: 'rotate(-6deg)' }}>T</span>
              <div className="serif" style={{ fontSize: 24 }}>Tezis</div>
            </div>
            <p style={{ marginTop: 14, fontSize: 14, color: 'var(--ink-3)', maxWidth: 340, lineHeight: 1.55 }}>
              Академический генератор презентаций. Каждый тезис — со ссылкой на страницу источника.
            </p>
            <div className="mono tiny muted" style={{ marginTop: 20 }}>
              © 2026 ООО «Тезис»
            </div>
          </div>
          <FooterCol title="Продукт" items={[['Пример', '#specimen'], ['Цены', '#pricing'], ['Telegram-бот', 'https://t.me/ai_presentations_test_bot']]} />
          <FooterCol title="Поддержка" items={[['support@tezis.app', 'mailto:support@tezis.app'], ['FAQ', '#'], ['Возврат', '#']]} />
          <FooterCol title="Документы" items={[['Оферта', '#'], ['Политика конфиденциальности', '#'], ['Согласие на обработку', '#']]} />
        </div>

        <div style={{ marginTop: 56, paddingTop: 20, borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between' }}>
          <div className="mono tiny muted">tezis.app</div>
          <div className="mono tiny muted">v.2026.04 · сделано со ссылкой на источник</div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Default export ─────────────────────────────────────────────────────── */

export default function Landing() {
  const { user } = useAuth()
  const ctaHref = user ? '/wizard' : '/register'

  return (
    <div>
      <Hero ctaHref={ctaHref} />
      <UploadSection ctaHref={ctaHref} />
      <Specimen />
      <Modes />
      <Process />
      <Features />
      <Pricing ctaHref={ctaHref} />
      <CtaStrip user={user} />
      <Footer />
    </div>
  )
}
