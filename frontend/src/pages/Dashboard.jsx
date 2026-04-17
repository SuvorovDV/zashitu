import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client.js'
import { ordersApi, filesApi } from '../api/index.js'
import { useWizardStore } from '../store/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { ConfirmDialog } from '../components/ui/Modal.jsx'
import { ru } from '../shared/i18n/ru.js'
import Spinner from '../components/ui/Spinner.jsx'


function SpeechDownloadLink({ orderId }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function onClick(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const resp = await client.get(filesApi.speechDownloadUrl(orderId), { responseType: 'blob' })
      // Имя файла — из Content-Disposition (filename*=UTF-8''…), если есть.
      let filename = 'speech.md'
      const cd = resp.headers?.['content-disposition'] || ''
      const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i)
      if (m) {
        try { filename = decodeURIComponent(m[1]) } catch { filename = m[1] }
      }
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Не удалось скачать текст')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title={busy ? 'Готовим текст с разметкой по слайдам…' : 'Скачать текст выступления (.md)'}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#221E17] hover:bg-[#2E2820] text-[#B8AE97] border border-[#4A402F] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A7362] disabled:opacity-60 disabled:cursor-wait"
    >
      {busy ? (
        <>
          <svg aria-hidden="true" className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Готовим…
        </>
      ) : (
        <>
          <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {ru.dashboard.actions.downloadSpeech}
        </>
      )}
    </button>
  )
}

const STATUS_MAP = {
  pending:         { dot: 'bg-[#7A7362]',       label: ru.dashboard.statuses.pending,         badge: 'text-[#B8AE97] bg-[#221E17] border-[#4A402F]' },
  paid:            { dot: 'bg-blue-400',         label: ru.dashboard.statuses.paid,            badge: 'text-blue-300 bg-blue-500/10 border-blue-500/25' },
  generating:      { dot: 'bg-yellow-400 animate-pulse-slow', label: ru.dashboard.statuses.generating, badge: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/25' },
  awaiting_review: { dot: 'bg-amber-400 animate-pulse-slow',  label: ru.dashboard.statuses.awaiting_review, badge: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  done:            { dot: 'bg-green-400',        label: ru.dashboard.statuses.done,            badge: 'text-green-300 bg-green-500/10 border-green-500/25' },
  failed:          { dot: 'bg-red-400',          label: ru.dashboard.statuses.failed,          badge: 'text-red-300 bg-red-500/10 border-red-500/25' },
}

const TIER_LABEL = { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${s.badge}`}>
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const reset = useWizardStore((s) => s.reset)
  const queryClient = useQueryClient()
  const toast = useToast()
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

  function handleNew() {
    reset()
    navigate('/wizard')
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ textWrap: 'balance' }}>
            {ru.dashboard.title}
          </h1>
          <p className="text-[#7A7362] text-sm mt-1">{ru.dashboard.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {ru.dashboard.newButton}
        </button>
      </div>

      {isLoading ? (
        <div
          className="flex justify-center py-24"
          role="status"
          aria-live="polite"
          aria-label={ru.common.loading}
        >
          <Spinner size="lg" />
        </div>

      ) : !orders?.length ? (
        <div className="card rounded-2xl flex flex-col items-center justify-center py-28 px-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#221E17] border border-[#4A402F] flex items-center justify-center mb-5">
            <svg aria-hidden="true" className="w-7 h-7 text-[#7A7362]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg mb-1.5">{ru.dashboard.emptyTitle}</p>
          <p className="text-[#7A7362] text-sm mb-7">{ru.dashboard.emptySub}</p>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {ru.dashboard.emptyCta}
          </button>
        </div>

      ) : (
        <div className="flex flex-col gap-2.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="card rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#221E17] hover:border-[#4A402F] transition-colors duration-150"
            >
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <span className="font-semibold text-white truncate leading-snug">{order.topic}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={order.status} />
                  <span aria-hidden="true" className="text-[#2E2820] text-xs">·</span>
                  <span className="text-[#7A7362] text-xs">
                    {TIER_LABEL[order.tier] || order.tier}
                  </span>
                  <span aria-hidden="true" className="text-[#2E2820] text-xs">·</span>
                  <time
                    dateTime={order.created_at}
                    className="text-[#7A7362] text-xs tabular-nums"
                  >
                    {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(order.created_at))}
                  </time>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {order.status === 'done' && (
                  <>
                    <a
                      href={filesApi.downloadUrl(order.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600/15 hover:bg-brand-600/25 text-brand-300 border border-brand-500/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {ru.dashboard.actions.download}
                    </a>
                    {order.include_speech && <SpeechDownloadLink orderId={order.id} />}
                  </>
                )}
                {order.status === 'generating' && (
                  <Link
                    to={`/generation?order_id=${order.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                  >
                    {ru.dashboard.actions.watch}
                  </Link>
                )}
                {(order.status === 'awaiting_review' || order.status === 'paid') && (
                  <Link
                    to={`/generation?order_id=${order.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    {ru.dashboard.actions.open}
                  </Link>
                )}
                {order.status === 'pending' && (
                  <Link
                    to={`/payment?order_id=${order.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600/15 hover:bg-brand-600/25 text-brand-300 border border-brand-500/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {ru.dashboard.actions.pay}
                  </Link>
                )}

                <button
                  type="button"
                  aria-label={`Удалить заказ «${order.topic}»`}
                  onClick={() => setToDelete(order)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A7362] hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  )
}
