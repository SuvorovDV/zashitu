import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client.js'
import { ordersApi, filesApi } from '../api/index.js'
import { useWizardStore } from '../store/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { ConfirmDialog } from '../components/ui/Modal.jsx'
import { ru } from '../shared/i18n/ru.js'
import Spinner from '../components/ui/Spinner.jsx'
import Mascot from '../components/ui/Mascot.jsx'

/* Mapping from backend statuses to bundle badge classes.
 * Backend: pending (awaiting payment) / paid / generating / awaiting_review / done / failed
 */
const STATUS_BADGE = {
  pending:         { cls: 'payment',    label: ru.dashboard.statuses.pending },
  paid:            { cls: 'pending',    label: ru.dashboard.statuses.paid },
  generating:      { cls: 'generating', label: ru.dashboard.statuses.generating },
  awaiting_review: { cls: 'awaiting',   label: ru.dashboard.statuses.awaiting_review },
  done:            { cls: 'completed',  label: ru.dashboard.statuses.done },
  failed:          { cls: 'failed',     label: ru.dashboard.statuses.failed },
}

const IN_PROGRESS = new Set(['pending', 'paid', 'generating', 'awaiting_review'])

const TIER_LABEL = { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.pending
  return <span className={'badge ' + s.cls}><span className="dot" />{s.label}</span>
}

function SpeechDownloadLink({ orderId }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function onClick(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const resp = await client.get(filesApi.speechDownloadUrl(orderId), { responseType: 'blob' })
      let filename = 'speech.md'
      const cd = resp.headers?.['content-disposition'] || ''
      const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i)
      if (m) {
        try { filename = decodeURIComponent(m[1]) } catch { filename = m[1] }
      }
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Не удалось скачать текст')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={onClick}
      title={busy ? 'Готовим текст с разметкой по слайдам…' : 'Скачать текст выступления (.md)'}
    >
      {busy ? <><span className="spin" /> готовим…</> : <>речь .md</>}
    </button>
  )
}

function Counter({ n, label, accent }) {
  return (
    <div>
      <div
        className="serif tabular-nums"
        style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-0.02em', color: accent ? 'var(--accent)' : 'var(--ink)' }}
      >
        {n}
      </div>
      <div className="mono tiny muted" style={{ marginTop: 6 }}>{label}</div>
    </div>
  )
}

function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
        border: 0, padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: active ? 600 : 500,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {label}
      <span
        className="mono tiny tabular-nums"
        style={{ color: active ? 'rgba(14,14,12,0.55)' : 'var(--ink-3)' }}
      >
        {count}
      </span>
    </button>
  )
}

function OrderActions({ order }) {
  if (order.status === 'done') {
    return (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href={filesApi.downloadUrl(order.id)} className="btn btn-primary btn-sm">
          Скачать .pptx
        </a>
        {order.include_speech && <SpeechDownloadLink orderId={order.id} />}
      </div>
    )
  }
  if (order.status === 'generating') {
    return (
      <Link to={`/generation?order_id=${order.id}`} className="btn btn-ghost btn-sm">
        <span className="spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        генерируется…
      </Link>
    )
  }
  if (order.status === 'awaiting_review' || order.status === 'paid') {
    return (
      <Link to={`/generation?order_id=${order.id}`} className="btn btn-primary btn-sm">
        Проверить текст <span className="arrow">→</span>
      </Link>
    )
  }
  if (order.status === 'pending') {
    return (
      <Link to={`/payment?order_id=${order.id}`} className="btn btn-primary btn-sm">
        Доплатить
      </Link>
    )
  }
  if (order.status === 'failed') {
    return <span className="mono tiny muted">попробуйте заново</span>
  }
  return null
}

function OrderCard({ order, onDelete }) {
  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 24,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <StatusBadge status={order.status} />
          <span className="mono tiny muted">
            {TIER_LABEL[order.tier] || order.tier}
            {order.include_speech ? ' · + речь' : ' · только слайды'}
          </span>
        </div>
        <div
          className="serif"
          style={{ fontSize: 22, letterSpacing: '-0.015em', lineHeight: 1.25, color: 'var(--ink)' }}
        >
          {order.topic}
        </div>
        <time
          dateTime={order.created_at}
          className="mono tiny muted"
          style={{ marginTop: 8, display: 'inline-block' }}
        >
          {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
            .format(new Date(order.created_at))}
        </time>
      </div>
      <div><OrderActions order={order} /></div>
      <button
        type="button"
        onClick={() => onDelete(order)}
        aria-label={`Удалить заказ «${order.topic}»`}
        style={{
          width: 34, height: 34, borderRadius: 8, border: 0,
          background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .15s, color .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--err)'; e.currentTarget.style.background = 'var(--err-wash)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}
      >
        <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const reset = useWizardStore((s) => s.reset)
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState('all')
  const [toDelete, setToDelete] = useState(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => ordersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(ru.toast.deleted)
    },
    onError: () => toast.error(ru.toast.deleteFailed),
  })

  const counts = useMemo(() => {
    const o = orders || []
    return {
      all:      o.length,
      done:     o.filter((x) => x.status === 'done').length,
      progress: o.filter((x) => IN_PROGRESS.has(x.status)).length,
      failed:   o.filter((x) => x.status === 'failed').length,
    }
  }, [orders])

  const filtered = useMemo(() => {
    const o = orders || []
    if (tab === 'all')      return o
    if (tab === 'done')     return o.filter((x) => x.status === 'done')
    if (tab === 'progress') return o.filter((x) => IN_PROGRESS.has(x.status))
    if (tab === 'failed')   return o.filter((x) => x.status === 'failed')
    return o
  }, [orders, tab])

  function handleNew() {
    reset()
    navigate('/wizard')
  }

  if (isLoading) {
    return (
      <section style={{ paddingTop: 56, paddingBottom: 96 }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'center' }}>
          <Spinner size="lg" />
        </div>
      </section>
    )
  }

  const isEmpty = !orders || orders.length === 0

  return (
    <main>
      <section style={{ paddingTop: 56, paddingBottom: 24 }}>
        <div className="wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>Дашборд</div>
              <h1
                className="serif"
                style={{ fontSize: 'clamp(40px, 4.4vw, 64px)', margin: 0, lineHeight: 1.05, letterSpacing: '-0.02em' }}
              >
                {isEmpty
                  ? <>Добро пожаловать, <span className="hl">в Tezis</span></>
                  : <>Ваши <span className="hl">презентации</span></>
                }
              </h1>
              {isEmpty && (
                <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 620 }}>
                  Здесь будут все ваши презентации — заказанные, в процессе и готовые к защите.
                </p>
              )}
            </div>
            {!isEmpty && (
              <button className="btn btn-primary" onClick={handleNew}>
                Создать презентацию <span className="arrow">→</span>
              </button>
            )}
          </div>

          {!isEmpty && (
            <div style={{ marginTop: 20, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <Counter n={counts.all} label="всего" />
              <Counter n={counts.done} label="готово" accent />
              <Counter n={counts.progress} label="в процессе" />
              <Counter n={counts.failed} label="ошибок" />
            </div>
          )}
        </div>
      </section>

      <section style={{ paddingBottom: 96 }}>
        <div className="wrap">
          {isEmpty ? (
            <div
              className="card"
              style={{
                padding: '56px 40px',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 32,
                alignItems: 'center',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Mascot size={110} state="happy" />
                <div
                  className="hand"
                  style={{
                    position: 'absolute', right: -30, top: -8,
                    fontSize: 22, color: 'var(--accent)', transform: 'rotate(-4deg)',
                  }}
                >
                  давай!
                </div>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  У вас пока нет презентаций
                </div>
                <p style={{ marginTop: 10, color: 'var(--ink-2)', fontSize: 15.5, maxWidth: 520 }}>
                  Загрузите PDF или DOCX — и через 1–2 минуты получите .pptx, где каждый тезис
                  помечен страницей источника.
                </p>
              </div>
              <button className="btn btn-primary" onClick={handleNew}>
                Создать первую <span className="arrow">→</span>
              </button>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: 4,
                  border: '1px solid var(--rule-strong)', borderRadius: 999,
                  width: 'fit-content', marginBottom: 20,
                }}
              >
                <Tab label="Все"        count={counts.all}      active={tab === 'all'}      onClick={() => setTab('all')} />
                <Tab label="В процессе" count={counts.progress} active={tab === 'progress'} onClick={() => setTab('progress')} />
                <Tab label="Готовые"    count={counts.done}     active={tab === 'done'}     onClick={() => setTab('done')} />
                <Tab label="Ошибки"     count={counts.failed}   active={tab === 'failed'}   onClick={() => setTab('failed')} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>
                    Нет заказов в этой категории
                  </div>
                ) : (
                  filtered.map((o) => <OrderCard key={o.id} order={o} onDelete={setToDelete} />)
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        title={toDelete ? ru.dashboard.deletePrompt(toDelete.topic) : ''}
        description={ru.dashboard.deleteDesc}
        confirmLabel={ru.common.delete}
        cancelLabel={ru.common.cancel}
        tone="danger"
      />
    </main>
  )
}
