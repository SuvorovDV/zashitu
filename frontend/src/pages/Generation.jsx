import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGenerationStatus } from '../hooks/index.js'
import { useWizardStore } from '../store/index.js'
import client from '../api/client.js'
import { filesApi, generationApi } from '../api/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { isUuid } from '../lib/uuid.js'
import { ru } from '../shared/i18n/ru.js'
import Spinner from '../components/ui/Spinner.jsx'
import SlidePreview from '../components/generation/SlidePreview.jsx'
import Mascot from '../components/ui/Mascot.jsx'

const GENERATING_MESSAGES = ru.generation.steps

/* ─── Stage state-machine (preserved from previous impl) ──────────────────── */
function computeStage(data) {
  if (!data) return 'queued'
  if (data.status === 'failed') return 'failed'

  const needSpeech = !!data.include_speech
  if (!needSpeech) {
    if (data.status === 'done' || data.slides_approved) return 'done'
    return 'slides_drafting'
  }
  if (!data.speech_approved) {
    if (data.status === 'awaiting_review' && data.speech_text) return 'speech_review'
    return 'speech_drafting'
  }
  if (!data.slides_approved) {
    if (data.status === 'awaiting_review' && data.output_filename) return 'slides_review'
    if (data.status === 'done') return 'done'
    return 'slides_drafting'
  }
  return 'done'
}

/* ─── Speech markdown renderer with (с. N) highlights ─────────────────────── */
function SpeechMarkdown({ text }) {
  const lines = (text || '').split('\n')
  return (
    <pre
      className="mono"
      style={{
        margin: 0, padding: '22px 24px',
        fontSize: 13.5, lineHeight: 1.75,
        color: 'var(--ink-2)', whiteSpace: 'pre-wrap',
        maxHeight: 520, overflowY: 'auto',
      }}
    >
      {lines.map((line, i) => {
        const m = line.match(/(\(с\.\s*\d+\))/)
        if (m) {
          const parts = line.split(m[0])
          return (
            <div key={i}>
              {parts[0]}
              <span
                style={{
                  background: 'var(--accent-wash)', color: 'var(--accent)',
                  padding: '1px 6px', borderRadius: 3,
                }}
              >
                {m[0]}
              </span>
              {parts[1]}
            </div>
          )
        }
        if (line.startsWith('# ')) {
          return <div key={i} style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', marginTop: 14, marginBottom: 8, letterSpacing: '-0.01em' }}>{line.slice(2)}</div>
        }
        if (line.startsWith('## ')) {
          return <div key={i} style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', marginTop: 18, marginBottom: 6 }}>{line.slice(3)}</div>
        }
        return <div key={i}>{line}</div>
      })}
    </pre>
  )
}

/* ─── Stepper for include_speech flow ─────────────────────────────────────── */
function StageStepper({ stage, data }) {
  const steps = [
    { id: 'speech_drafting', label: '1. Текст',  doneIf: data.speech_approved,
      activeIf: stage === 'speech_drafting' || stage === 'speech_review' },
    { id: 'slides_drafting', label: '2. Слайды', doneIf: data.slides_approved,
      activeIf: stage === 'slides_drafting' || stage === 'slides_review' },
    { id: 'done',            label: '3. Готово', doneIf: stage === 'done',
      activeIf: stage === 'done' },
  ]
  return (
    <ol
      style={{
        margin: '0 0 28px 0', padding: 0, listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}
    >
      {steps.map((s, i) => {
        const cls = s.doneIf ? 'completed' : s.activeIf ? 'awaiting' : 'pending'
        return (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={'badge ' + cls}>
              <span className="dot" />
              {s.doneIf ? '✓ ' : ''}{s.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="mono tiny muted">—</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ─── Queued / Drafting ───────────────────────────────────────────────────── */
function QueuedView({ title, sub }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 40, alignItems: 'center', paddingTop: 24 }}>
      <Mascot size={120} state="idle" />
      <div>
        <div className="kicker" style={{ marginBottom: 12 }}>статус · в очереди</div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          {title} <span className="hl">Встали в очередь</span>.
        </h1>
        <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 560 }}>
          {sub} Можно закрыть эту вкладку — вернётесь позже.
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
                opacity: 0.25 + i * 0.15,
                animation: `pulse-badge 1.4s ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DraftingView({ title, sub }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'end', marginBottom: 28 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>статус · generating</div>
          <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            <span className="hl">{title}</span>
          </h1>
          <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 560 }}>
            {sub}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <Mascot size={110} state="verify" />
          <div
            className="hand"
            style={{ position: 'absolute', left: -64, top: 4, fontSize: 20, color: 'var(--accent)', transform: 'rotate(-4deg)', width: 90, lineHeight: 1.1 }}
          >
            ищу с. 47…
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0 24px' }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--rule-strong)' }} />
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid var(--accent)', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        </div>
        <div className="mono tiny muted" style={{ textAlign: 'center' }}>
          обычно занимает 30–120 секунд
        </div>
      </div>
    </div>
  )
}

/* ─── Speech review ───────────────────────────────────────────────────────── */
function SpeechReview({ text, used, max, onApprove, onRegenerate, approving, regenerating }) {
  const left = max - used
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>статус · awaiting review · текст</div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          Речь готова — <span className="hl">проверьте</span>.
        </h1>
        <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 640 }}>
          Прочитайте текст. Все факты и цифры — из вашего файла, со ссылками на страницы. Если что-то не так — отправьте на пересборку с пометкой.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 16px', borderBottom: '1px solid var(--rule)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-2)',
            }}
          >
            <span className="mono tiny muted">речь.md · {(text || '').length} симв.</span>
            <span className="mono tiny" style={{ color: 'var(--accent)' }}>правок: {used} / {max}</span>
          </div>
          <SpeechMarkdown text={text} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onApprove}
            disabled={approving || regenerating}
            style={{ justifyContent: 'center', padding: '14px 20px', fontSize: 15 }}
          >
            {approving ? <><span className="spin" /> принимаем…</> : <>Принять <span className="arrow">→</span></>}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRegenerate}
            disabled={left <= 0 || regenerating || approving}
            style={{ justifyContent: 'center' }}
          >
            Перегенерировать{left > 0 ? ` (осталось ${left})` : ' (лимит)'}
          </button>
          <div className="mono tiny muted" style={{ padding: '0 4px', lineHeight: 1.5 }}>
            После принятия соберём финальный .pptx и .md — скачать можно будет в Дашборде.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Slides review ───────────────────────────────────────────────────────── */
function SlidesReview({ plan, orderId, previewCount, used, max, onApprove, onRegenerate, approving, regenerating }) {
  const left = max - used
  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>статус · awaiting review · слайды</div>
          <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Предпросмотр — <span className="hl">проверьте</span>.
          </h1>
          <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 640 }}>
            Проверьте страницы. Можно пересобрать или утвердить и скачать .pptx.
          </p>
        </div>
        <span className="mono tiny" style={{ color: 'var(--accent)' }}>правок: {used} / {max}</span>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <SlidePreview plan={plan} orderId={orderId} previewCount={previewCount} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRegenerate}
          disabled={left <= 0 || regenerating || approving}
        >
          Пересобрать{left > 0 ? ` (осталось ${left})` : ' (лимит)'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onApprove}
          disabled={approving || regenerating}
        >
          {approving ? <><span className="spin" /> принимаем…</> : <>Принять и скачать <span className="arrow">→</span></>}
        </button>
      </div>
    </div>
  )
}

/* ─── Done / Failed ───────────────────────────────────────────────────────── */
function DoneView({ orderId, data, onNew }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', paddingTop: 24 }}>
      <div>
        <div className="kicker" style={{ marginBottom: 12 }}>статус · completed</div>
        <h1 className="serif" style={{ fontSize: 'clamp(44px, 5.5vw, 72px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
          Готово. <span className="hl">Защищайтесь.</span>
        </h1>
        <p style={{ marginTop: 16, fontSize: 16.5, color: 'var(--ink-2)', maxWidth: 560 }}>
          Каждый тезис помечен страницей источника. Файл редактируется в PowerPoint, Keynote и Google Slides.
        </p>
        <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={filesApi.downloadUrl(orderId)} className="btn btn-primary">
            Скачать .pptx <span className="arrow">↓</span>
          </a>
          {data.speech_text && <SpeechDownloadButton orderId={orderId} />}
          <button className="btn-text" onClick={onNew} style={{ cursor: 'pointer', fontSize: 14 }}>
            Создать ещё →
          </button>
        </div>
        <TechnicalPromptInspector data={data} />
      </div>
      <Mascot size={140} state="happy" />
    </div>
  )
}

function SpeechDownloadButton({ orderId }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function onClick() {
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
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Не удалось скачать текст')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClick}>
      {busy ? <><span className="spin" /> готовим…</> : <>Скачать .md</>}
    </button>
  )
}

function FailedView({ data, onBack }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 40, alignItems: 'center', paddingTop: 24 }}>
      <Mascot size={120} state="sad" />
      <div>
        <div className="kicker" style={{ marginBottom: 12, color: 'var(--err)' }}>статус · failed</div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 60px)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          Что-то пошло не так.
        </h1>
        {data?.error_message && (
          <div
            className="mono tiny"
            style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 10, maxWidth: 520,
              color: 'var(--err)', background: 'var(--err-wash)', border: '1px solid var(--err)',
            }}
          >
            {data.error_message}
          </div>
        )}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="mailto:support@tezis.app" className="btn btn-primary">Написать в поддержку</a>
          <button className="btn btn-ghost" onClick={onBack}>← К заказам</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Technical prompt inspector (dev aid) ────────────────────────────────── */
function TechnicalPromptInspector({ data }) {
  const [openKind, setOpenKind] = useState(null)
  const toast = useToast()
  const hasSpeech = !!data?.speech_prompt
  const hasSlides = !!data?.generation_prompt
  if (!hasSpeech && !hasSlides) return null

  async function copy(payload) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success(ru.toast.copied)
    } catch {
      toast.error(ru.toast.copyFailed)
    }
  }

  return (
    <div style={{ marginTop: 40, maxWidth: 720 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Технические промты</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {hasSpeech && (
          <button
            type="button"
            onClick={() => setOpenKind(openKind === 'speech' ? null : 'speech')}
            className="mono tiny"
            style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: openKind === 'speech' ? 'var(--accent-wash)' : 'transparent',
              color: openKind === 'speech' ? 'var(--accent)' : 'var(--ink-2)',
              border: '1px solid ' + (openKind === 'speech' ? 'var(--accent)' : 'var(--rule-strong)'),
            }}
          >
            Промт текста
          </button>
        )}
        {hasSlides && (
          <button
            type="button"
            onClick={() => setOpenKind(openKind === 'slides' ? null : 'slides')}
            className="mono tiny"
            style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: openKind === 'slides' ? 'var(--accent-wash)' : 'transparent',
              color: openKind === 'slides' ? 'var(--accent)' : 'var(--ink-2)',
              border: '1px solid ' + (openKind === 'slides' ? 'var(--accent)' : 'var(--rule-strong)'),
            }}
          >
            Промт слайдов
          </button>
        )}
      </div>

      {openKind === 'speech' && (
        <PromptPanel title="Текст выступления — system + user + pseudocode" payload={data.speech_prompt} onCopy={() => copy(data.speech_prompt)} />
      )}
      {openKind === 'slides' && (
        <PromptPanel title="Слайды — system + user + pseudocode + raw_response" payload={data.generation_prompt} onCopy={() => copy(data.generation_prompt)} />
      )}
    </div>
  )
}

function PromptPanel({ title, payload, onCopy }) {
  return (
    <div className="card" style={{ overflow: 'auto', maxHeight: '60vh' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid var(--rule)',
          position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1,
        }}
      >
        <span className="mono tiny muted">{title}</span>
        <button onClick={onCopy} className="mono tiny" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--accent)' }}>
          Копировать JSON
        </button>
      </div>
      <pre
        className="mono"
        style={{
          margin: 0, padding: 16, fontSize: 12, lineHeight: 1.55,
          color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  )
}

/* ─── Regenerate dialog ───────────────────────────────────────────────────── */
function RegenerateDialog({ open, onClose, title, note, onNote, placeholder, hint, remaining, onConfirm, confirmLabel }) {
  const canGo = remaining > 0
  return (
    <Modal open={open} onClose={onClose} title={title} labelledBy="regen-title">
      <p className="mono tiny muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
        Опишите, что хотите изменить (можно оставить пустым). Осталось попыток:{' '}
        <span className="tabular-nums" style={{ color: 'var(--ink)', fontWeight: 600 }}>{remaining}</span>.
      </p>
      <textarea
        className="textarea"
        rows={5}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="mono tiny muted" style={{ marginTop: 8 }}>{hint}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} disabled={!canGo}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}

/* ─── Default export ──────────────────────────────────────────────────────── */
export default function Generation() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const orderId = params.get('order_id')
  const reset = useWizardStore((s) => s.reset)

  const [regenKind, setRegenKind] = useState(null)
  const [regenNote, setRegenNote] = useState('')

  const { data } = useGenerationStatus(orderId)
  const status = data?.status
  const isBusy = status === 'generating' || status === 'paid' || status === 'pending'

  const [msgIndex, setMsgIndex] = useState(0)
  useEffect(() => {
    if (!isBusy) return
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % GENERATING_MESSAGES.length), 2500)
    return () => clearInterval(id)
  }, [isBusy])

  const regenSpeech = useMutation({
    mutationFn: (note) => generationApi.regenerateSpeech(orderId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generation', orderId] })
      toast.info('Переделываем текст…')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Ошибка регенерации'),
  })
  const approveSpeech = useMutation({
    mutationFn: () => generationApi.approveSpeech(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generation', orderId] })
      toast.success('Текст принят. Готовим презентацию…')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Ошибка'),
  })
  const regenSlides = useMutation({
    mutationFn: (note) => generationApi.regenerateSlides(orderId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generation', orderId] })
      toast.info('Пересобираем слайды…')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Ошибка регенерации'),
  })
  const approveSlides = useMutation({
    mutationFn: () => generationApi.approveSlides(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generation', orderId] })
      toast.success('Готово!')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Ошибка'),
  })

  if (!isUuid(orderId)) {
    return (
      <section style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div className="wrap" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          Заказ не найден.{' '}
          <Link to="/dashboard" style={{ color: 'var(--accent)', borderBottom: 0 }}>К списку заказов</Link>
        </div>
      </section>
    )
  }

  const stage = computeStage(data)

  return (
    <main>
      <section style={{ paddingTop: 56, paddingBottom: 96 }}>
        <div className="wrap">
          {data?.include_speech && <StageStepper stage={stage} data={data} />}

          {(stage === 'queued') && (
            <QueuedView title="Оплата подтверждена." sub="Через ~60 секунд начнём." />
          )}

          {stage === 'speech_drafting' && (
            <DraftingView title="Пишем текст выступления" sub={GENERATING_MESSAGES[msgIndex]} />
          )}

          {stage === 'speech_review' && (
            <SpeechReview
              text={data.speech_text}
              used={data.speech_revisions || 0}
              max={data.max_speech_revisions || 10}
              onApprove={() => approveSpeech.mutate()}
              onRegenerate={() => { setRegenNote(''); setRegenKind('speech') }}
              approving={approveSpeech.isPending}
              regenerating={regenSpeech.isPending}
            />
          )}

          {stage === 'slides_drafting' && (
            <DraftingView title="Строим презентацию" sub={GENERATING_MESSAGES[msgIndex]} />
          )}

          {stage === 'slides_review' && (
            <SlidesReview
              plan={data.slide_plan}
              orderId={orderId}
              previewCount={data.preview_count}
              used={data.slides_revisions || 0}
              max={data.max_slides_revisions || 5}
              onApprove={() => approveSlides.mutate()}
              onRegenerate={() => { setRegenNote(''); setRegenKind('slides') }}
              approving={approveSlides.isPending}
              regenerating={regenSlides.isPending}
            />
          )}

          {stage === 'done' && (
            <DoneView orderId={orderId} data={data} onNew={() => { reset(); navigate('/wizard') }} />
          )}

          {stage === 'failed' && (
            <FailedView data={data} onBack={() => navigate('/dashboard')} />
          )}
        </div>
      </section>

      <RegenerateDialog
        open={regenKind === 'speech'}
        onClose={() => setRegenKind(null)}
        title="Переделать текст?"
        note={regenNote}
        onNote={setRegenNote}
        placeholder="Сделать вступление короче, заменить формулировку тезиса 2 на..."
        remaining={(data?.max_speech_revisions || 10) - (data?.speech_revisions || 0)}
        onConfirm={() => { regenSpeech.mutate(regenNote.trim()); setRegenKind(null) }}
        confirmLabel="Переделать"
      />
      <RegenerateDialog
        open={regenKind === 'slides'}
        onClose={() => setRegenKind(null)}
        title="Пересобрать презентацию?"
        note={regenNote}
        onNote={setRegenNote}
        placeholder="Сделать слайд 3 более визуальным, разбить тезис 5 на 2 буллета..."
        hint="Слайды не могут содержать информацию, которой нет в утверждённом тексте."
        remaining={(data?.max_slides_revisions || 5) - (data?.slides_revisions || 0)}
        onConfirm={() => { regenSlides.mutate(regenNote.trim()); setRegenKind(null) }}
        confirmLabel="Пересобрать"
      />
    </main>
  )
}
