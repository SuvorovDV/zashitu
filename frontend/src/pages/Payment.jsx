import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi, ordersApi } from '../api/index.js'
import client from '../api/client.js'
import { useWizardStore } from '../store/index.js'
import { useDevMode } from '../hooks/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { isUuid } from '../lib/uuid.js'
import { tierFits, minTierFor } from '../lib/tiers.js'
import { ru } from '../shared/i18n/ru.js'
import Spinner from '../components/ui/Spinner.jsx'
import FileUpload from '../components/ui/FileUpload.jsx'

function formatRub(n) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
}

function Row({ k, v, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span className="mono tiny muted">{k}</span>
      <span style={{ color: accent ? 'var(--accent)' : 'var(--ink)', fontWeight: accent ? 600 : 400 }}>{v}</span>
    </div>
  )
}

const UPGRADE_BENEFITS = {
  'basic->standard': [
    'До 20 слайдов вместо 12',
    'До 25 минут выступления вместо 15',
    'Подробнее раскрывает каждую секцию',
  ],
  'basic->premium': [
    'До 30 слайдов вместо 12',
    'До 45 минут выступления вместо 15',
    'Claude Opus — более глубокая модель',
    'Сильнее справляется с большими работами',
  ],
  'standard->premium': [
    'До 30 слайдов вместо 20',
    'До 45 минут выступления вместо 25',
    'Claude Opus — более глубокая модель',
    'Лучше для диплома и больших докладов',
  ],
}

function UpgradeOption({ currentKey, tier, currentPrice, onChoose }) {
  const key = `${currentKey}->${tier.id}`
  const benefits = UPGRADE_BENEFITS[key] || []
  const delta = tier.price_rub - currentPrice
  return (
    <button
      type="button"
      onClick={() => onChoose(tier.id)}
      className="card"
      style={{
        padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface)', color: 'var(--ink)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="serif" style={{ fontSize: 18, letterSpacing: '-0.01em' }}>{tier.label}</span>
          <span
            className="mono tiny"
            style={{ color: 'var(--accent)', border: '1px solid var(--accent)', background: 'var(--accent-wash)', padding: '2px 8px', borderRadius: 999 }}
          >
            апгрейд
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="serif tabular-nums" style={{ fontSize: 18, lineHeight: 1 }}>{formatRub(tier.price_rub)}</div>
          {delta > 0 && <div className="mono tiny muted tabular-nums" style={{ marginTop: 2 }}>+{formatRub(delta)}</div>}
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--ink-2)' }}>
        {benefits.map((b) => (
          <li key={b} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 6 }}>
            <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}

const MODE_LABEL = {
  A: 'только слайды',
  B: '+ текст выступления',
}

export default function Payment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const orderId = params.get('order_id')
  const cancelled = params.get('cancelled') === '1'
  const isDev = useDevMode()

  const { tier, include_speech, slides_count, duration_minutes, mode, custom_elements, topic, setField } = useWizardStore()
  const [selectedTier, setSelectedTier] = useState(tier || 'basic')
  const [loading, setLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [error, setError] = useState(null)

  const validOrder = isUuid(orderId)

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['tiers'],
    queryFn: () => paymentsApi.getTiers().then((r) => r.data),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (selectedTier) setField('tier', selectedTier)
  }, [selectedTier])

  useEffect(() => {
    if (!tiers) return
    if (!tierFits(selectedTier, { slides_count, duration_minutes }, tiers)) {
      setSelectedTier(minTierFor({ slides_count, duration_minutes }, tiers))
    }
  }, [tiers, slides_count, duration_minutes])

  async function handlePay() {
    if (!validOrder) return
    setLoading(true)
    setError(null)
    try {
      await ordersApi.updateTier(orderId, selectedTier)
      await ordersApi.updateNotes(orderId, custom_elements || '')
      const res = await paymentsApi.createSession(orderId)
      window.location.href = res.data.checkout_url
    } catch (e) {
      const msg = e.response?.data?.detail || (e.code === 'ERR_NETWORK' ? ru.common.networkError : ru.payment.sessionFailed)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDevPay() {
    if (!validOrder) return
    setDevLoading(true)
    setError(null)
    try {
      await ordersApi.updateNotes(orderId, custom_elements || '')
      await client.post(
        `/dev/complete-payment/${orderId}`,
        { tier: selectedTier },
        { headers: { 'X-Dev-Token': import.meta.env.VITE_DEV_TOKEN || '' } },
      )
      navigate(`/generation?order_id=${orderId}`)
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || 'Ошибка симуляции'
      const msg = `[${e.response?.status ?? '?'}] ${detail}`
      setError(msg)
      toast.error(msg)
    } finally {
      setDevLoading(false)
    }
  }

  if (!validOrder) {
    return (
      <section style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div className="wrap" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          {ru.payment.orderNotFound}{' '}
          <Link to="/wizard" style={{ color: 'var(--accent)', borderBottom: 0 }}>Создать новый</Link>
        </div>
      </section>
    )
  }

  const selected = tiers?.[selectedTier]
  const currentOrder = tiers?.[selectedTier]?.order ?? 0
  const higher = tiers
    ? Object.values(tiers)
        .filter((t) => (t.order ?? 0) > currentOrder)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : []

  return (
    <main>
      <section style={{ paddingTop: 48, paddingBottom: 96 }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div className="kicker">Оплата заказа</div>
            <button
              onClick={() => navigate('/wizard')}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, fontFamily: 'var(--sans)' }}
            >
              ← изменить параметры
            </button>
          </div>
          <h1 className="serif" style={{ fontSize: 'clamp(40px, 4.5vw, 60px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Оплата — <span className="hl">и поехали</span>
          </h1>

          {cancelled && (
            <div
              className="mono tiny"
              style={{
                marginTop: 24, padding: '10px 14px', borderRadius: 10,
                color: 'var(--warn)', background: 'var(--warn-wash)', border: '1px solid var(--warn)',
              }}
            >
              {ru.payment.cancelled}
            </div>
          )}

          <div
            style={{
              marginTop: 32, display: 'grid', gap: 32, alignItems: 'start',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
            }}
          >
            {/* ─── Left: order summary ─── */}
            <div className="card" style={{ padding: 28 }}>
              <div className="kicker" style={{ marginBottom: 14 }}>Ваш заказ</div>
              <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.015em', lineHeight: 1.3, marginBottom: 18 }}>
                {topic || '—'}
              </div>

              {selected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
                  <Row k="Тариф"            v={selected.label} />
                  <Row k="Слайдов (макс.)"  v={selected.max_slides} />
                  <Row k="Длительность"     v={`до ${selected.max_duration_minutes} мин`} />
                  <Row k="Режим"            v={include_speech ? '+ речь' : 'только слайды'} />
                  <Row k="Формат"           v={include_speech ? '.pptx + .md' : '.pptx'} />
                  <Row k="Ссылки на страницы" v="включены" accent />
                </div>
              ) : (
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--rule)', color: 'var(--ink-3)' }}><Spinner size="sm" /></div>
              )}

              {selected && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="mono tiny muted">итого</div>
                  <div className="serif tabular-nums" style={{ fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {formatRub(selected.price_rub)}
                  </div>
                </div>
              )}

              <div className="mono tiny muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
                разовый платёж · без подписки · возврат в течение 24 часов, если генерация не удалась
              </div>
            </div>

            {/* ─── Right: adjust + pay ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mode !== 'no_template' && (
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>Файл работы</div>
                  <div className="mono tiny muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                    PDF или DOCX. Каждый тезис получит ссылку на страницу источника.
                  </div>
                  <FileUpload orderId={orderId} />
                </div>
              )}

              <div className="card" style={{ padding: '20px 24px' }}>
                <label className="label" htmlFor="pay-notes">Обязательно должно быть</label>
                <textarea
                  id="pay-notes"
                  className="textarea"
                  rows={4}
                  placeholder="Например: упомянуть эксперимент; акцент на практическом применении"
                  value={custom_elements || ''}
                  onChange={(e) => setField('custom_elements', e.target.value)}
                />
                <div className="mono tiny muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  {mode === 'no_template'
                    ? 'Свободный режим: распишите подробно, что должно быть в тексте и слайдах.'
                    : 'Дополнительные пожелания к содержанию — учтём вместе с файлом.'}
                </div>
              </div>

              {higher.length > 0 && (
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div className="kicker" style={{ marginBottom: 12 }}>Хотите больше?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {higher.map((t) => (
                      <UpgradeOption
                        key={t.id}
                        currentKey={selectedTier}
                        tier={t}
                        currentPrice={selected?.price_rub ?? 0}
                        onChoose={setSelectedTier}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner size="md" /></div>
              )}

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mono tiny"
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'center',
                    color: 'var(--err)', background: 'var(--err-wash)', border: '1px solid var(--err)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={loading || !selectedTier || isLoading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px 20px' }}
              >
                {loading
                  ? <><span className="spin" /> обработка…</>
                  : <>Оплатить{selected ? ` — ${formatRub(selected.price_rub)}` : ''} <span className="arrow">→</span></>}
              </button>

              {isDev && (
                <button
                  type="button"
                  onClick={handleDevPay}
                  disabled={devLoading}
                  style={{
                    width: '100%', padding: '11px 16px',
                    background: 'transparent', color: 'var(--ink-3)',
                    border: '1px dashed var(--rule-strong)', borderRadius: 999,
                    fontFamily: 'var(--mono)', fontSize: 12, cursor: devLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: devLoading ? 0.5 : 1,
                  }}
                >
                  {devLoading && <span className="spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />}
                  [dev] {ru.payment.devSim}
                </button>
              )}

              <div className="mono tiny muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>
                нажимая «Оплатить», вы соглашаетесь с{' '}
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--accent)', borderBottom: 0 }}>офертой</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
