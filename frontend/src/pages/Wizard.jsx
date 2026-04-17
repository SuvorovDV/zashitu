import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../store/index.js'
import { ordersApi } from '../api/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { minTierFor } from '../lib/tiers.js'
import FileUpload from '../components/ui/FileUpload.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { ru } from '../shared/i18n/ru.js'

const STEPS = [
  lazy(() => import('../components/wizard/steps/Step1Topic.jsx')),
  lazy(() => import('../components/wizard/steps/Step2Direction.jsx')),
  lazy(() => import('../components/wizard/steps/Step3WorkType.jsx')),
  lazy(() => import('../components/wizard/steps/Step4Duration.jsx')),
  lazy(() => import('../components/wizard/steps/Step5Detail.jsx')),
  lazy(() => import('../components/wizard/steps/Step6Thesis.jsx')),
  lazy(() => import('../components/wizard/steps/Step7University.jsx')),
  lazy(() => import('../components/wizard/steps/Step8Elements.jsx')),
  lazy(() => import('../components/wizard/steps/Step9Mode.jsx')),
  lazy(() => import('../components/wizard/steps/Step10Palette.jsx')),
]

const STEP_NAMES = [
  'Тема',
  'Направление',
  'Тип работы',
  'Объём',
  'Детализация',
  'Тезис',
  'Университет',
  'Элементы',
  'Режим',
  'Палитра',
]

const TIER_LABEL = { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }

function canProceed(step, store) {
  if (step === 1) return store.topic.trim().length > 0
  return true
}

function SummaryPanel({ store, currentStep, onJump }) {
  const rows = [
    { i: 1,  k: 'Тема',         v: store.topic || '—' },
    { i: 1,  k: 'Режим',        v: store.include_speech ? '+ речь' : 'только слайды' },
    { i: 2,  k: 'Направление',  v: store.direction || '—' },
    { i: 3,  k: 'Тип работы',   v: store.work_type || '—' },
    { i: 4,  k: 'Объём',        v: store.slides_count
        ? `${store.slides_count} сл.`
        : `${store.duration_minutes || 15} мин` },
    { i: 5,  k: 'Детализация',  v: store.detail_level || '—' },
    { i: 6,  k: 'Тезис',        v: store.thesis ? store.thesis.slice(0, 60) + (store.thesis.length > 60 ? '…' : '') : '—' },
    { i: 7,  k: 'Университет',  v: store.university || '—' },
    { i: 8,  k: 'Обязательно',  v: (store.custom_elements?.trim() || store.required_elements?.length) ? 'есть' : '—' },
    { i: 10, k: 'Палитра',      v: store.palette || 'midnight_executive' },
    { i: 10, k: 'Тариф',        v: TIER_LABEL[store.tier] || store.tier },
  ]
  return (
    <aside style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
      <div className="card" style={{ padding: 22 }}>
        <div className="kicker" style={{ marginBottom: 14 }}>Сводка</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onJump(r.i)}
              style={{
                display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, textAlign: 'left',
                background: currentStep === r.i ? 'var(--surface-2)' : 'transparent',
                border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                color: 'inherit', fontFamily: 'inherit',
              }}
            >
              <span className="mono tiny muted">{r.k}</span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.v}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="hand" style={{ marginTop: 16, fontSize: 18, color: 'var(--ink-3)', padding: '0 8px' }}>
        можно кликнуть на строку, чтобы изменить →
      </div>
    </aside>
  )
}

export default function Wizard() {
  const navigate = useNavigate()
  const toast = useToast()
  const store = useWizardStore()
  const { currentStep, nextStep, prevStep, goToStep, getFormData, setOrderId, orderId,
          slides_count, duration_minutes, detail_level, tier, setField } = store

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)

  // Централизованный авто-синк минимально подходящего тарифа под все выборы пользователя.
  const requiredTier = minTierFor({
    slides_count,
    duration_minutes: slides_count ? null : duration_minutes,
    detail_level,
  })
  useEffect(() => {
    if (tier !== requiredTier) setField('tier', requiredTier)
  }, [requiredTier])

  useEffect(() => {
    // Фокус на первом интерактивном элементе шага — помогает клавиатуре.
    const el = contentRef.current?.querySelector('input,textarea,select,button')
    el?.focus?.({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [currentStep])

  const StepComponent = STEPS[currentStep - 1]
  const isLast = currentStep === 10
  const ok = canProceed(currentStep, store)

  async function handleNext() {
    if (!ok) return
    if (isLast) {
      setSubmitting(true)
      setError(null)
      try {
        const res = await ordersApi.create(getFormData())
        const newOrderId = res.data.id
        setOrderId(newOrderId)
        navigate(`/payment?order_id=${newOrderId}`)
      } catch (e) {
        const msg =
          e.code === 'ERR_NETWORK'
            ? ru.common.networkError
            : e.response?.data?.detail || ru.wizard.orderFailed
        setError(msg)
        toast.error(msg)
      } finally {
        setSubmitting(false)
      }
    } else {
      nextStep()
    }
  }

  function handleKey(e) {
    // Enter → Далее, кроме textarea (там allow newlines).
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleNext()
    }
  }

  const progressPct = (currentStep / 10) * 100

  return (
    <main onKeyDown={handleKey}>
      {/* Progress header */}
      <section style={{ paddingTop: 40, paddingBottom: 24 }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="kicker">
              Создание презентации · шаг {currentStep} из 10 · {STEP_NAMES[currentStep - 1]}
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'transparent', border: 0, cursor: 'pointer',
                color: 'var(--ink-3)', fontSize: 13, fontFamily: 'var(--sans)',
              }}
            >
              ← к дашборду
            </button>
          </div>

          <div style={{ height: 3, background: 'var(--rule)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)', transition: 'width .25s ease' }} />
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            {STEP_NAMES.map((_, i) => {
              const n = i + 1
              const isCurrent = n === currentStep
              const isPast = n < currentStep
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToStep(n)}
                  className="mono tiny"
                  style={{
                    background: 'transparent', border: 0,
                    color: isCurrent ? 'var(--ink)' : isPast ? 'var(--ink-2)' : 'var(--ink-4)',
                    cursor: 'pointer', padding: '2px 0',
                  }}
                >
                  {String(n).padStart(2, '0')}{isCurrent && ' ●'}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Main grid: content + sticky summary */}
      <section style={{ paddingBottom: 96 }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 40, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ padding: 28, marginBottom: 20 }} ref={contentRef}>
              <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner size="md" /></div>}>
                <div key={currentStep}><StepComponent /></div>
              </Suspense>

              {currentStep >= 2 && orderId && (
                <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
                  <div className="label" style={{ marginBottom: 10 }}>файл работы (PDF или DOCX)</div>
                  <FileUpload orderId={orderId} />
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mono tiny"
                style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 10, textAlign: 'center',
                  color: 'var(--err)', background: 'var(--err-wash)', border: '1px solid var(--err)',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1 || submitting}
                className="btn btn-ghost"
                style={{ opacity: currentStep === 1 ? 0.4 : 1 }}
              >
                ← Назад
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!ok || submitting}
                className="btn btn-primary"
                style={{ opacity: !ok || submitting ? 0.5 : 1 }}
              >
                {submitting
                  ? <><span className="spin" /> создаём…</>
                  : isLast
                    ? <>Сгенерировать <span className="arrow">→</span></>
                    : <>Дальше <span className="arrow">→</span></>
                }
              </button>
            </div>
          </div>

          <SummaryPanel store={store} currentStep={currentStep} onJump={goToStep} />
        </div>
      </section>
    </main>
  )
}
