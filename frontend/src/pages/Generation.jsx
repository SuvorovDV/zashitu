import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGenerationStatus } from '../hooks/index.js'
import { useWizardStore } from '../store/index.js'
import client from '../api/client.js'
import { filesApi, generationApi } from '../api/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import Textarea from '../components/ui/Textarea.jsx'
import { isUuid } from '../lib/uuid.js'
import { ru } from '../shared/i18n/ru.js'
import Spinner from '../components/ui/Spinner.jsx'
import SlidePreview from '../components/generation/SlidePreview.jsx'

const GENERATING_MESSAGES = ru.generation.steps

export default function Generation() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const orderId = params.get('order_id')
  const reset = useWizardStore((s) => s.reset)

  const [regenKind, setRegenKind] = useState(null) // 'speech' | 'slides' | null
  const [regenNote, setRegenNote] = useState('')

  const { data, isLoading } = useGenerationStatus(orderId)
  const status = data?.status

  // Вращающееся «чем мы сейчас заняты» — только в фазах генерации.
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
      <div className="text-center py-24 text-[#7A7362]">
        Заказ не найден.{' '}
        <Link to="/dashboard" className="text-brand-400 hover:text-brand-300">К списку заказов</Link>
      </div>
    )
  }

  // Определяем стадию.
  const stage = computeStage(data)

  return (
    <div className="max-w-3xl mx-auto px-5 py-12 relative">
      <div aria-hidden="true" className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] rounded-full bg-brand-700/15 blur-[80px] pointer-events-none" />

      <div className="relative z-10">
        {/* Stage header — mini-stepper для include_speech-флоу */}
        {data?.include_speech && (
          <StageStepper stage={stage} data={data} />
        )}

        {stage === 'queued' || stage === 'speech_drafting' ? (
          <BigSpinner
            title={stage === 'speech_drafting' ? 'Пишем текст выступления' : 'Готовим заказ'}
            sub={GENERATING_MESSAGES[msgIndex]}
          />
        ) : null}

        {stage === 'speech_review' ? (
          <SpeechReview
            text={data.speech_text}
            used={data.speech_revisions}
            max={data.max_speech_revisions}
            onApprove={() => approveSpeech.mutate()}
            onRegenerate={() => { setRegenNote(''); setRegenKind('speech') }}
            approving={approveSpeech.isPending}
            regenerating={regenSpeech.isPending}
          />
        ) : null}

        {stage === 'slides_drafting' ? (
          <BigSpinner title="Строим презентацию" sub={GENERATING_MESSAGES[msgIndex]} />
        ) : null}

        {stage === 'slides_review' ? (
          <SlidesReview
            plan={data.slide_plan}
            orderId={orderId}
            previewCount={data.preview_count}
            used={data.slides_revisions}
            max={data.max_slides_revisions}
            onApprove={() => approveSlides.mutate()}
            onRegenerate={() => { setRegenNote(''); setRegenKind('slides') }}
            approving={approveSlides.isPending}
            regenerating={regenSlides.isPending}
          />
        ) : null}

        {stage === 'done' ? (
          <DoneView
            orderId={orderId}
            data={data}
            onNew={() => { reset(); navigate('/wizard') }}
          />
        ) : null}

        {stage === 'failed' ? <FailedView data={data} onBack={() => navigate('/dashboard')} /> : null}
      </div>

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
    </div>
  )
}

// ── Вычисление стадии флоу ────────────────────────────────────────────────────

function computeStage(data) {
  if (!data) return 'queued'
  if (data.status === 'failed') return 'failed'

  const needSpeech = !!data.include_speech
  if (!needSpeech) {
    // Без speech: всё проще.
    if (data.status === 'done' || data.slides_approved) return 'done'
    return 'slides_drafting'
  }

  // С speech:
  if (!data.speech_approved) {
    if (data.status === 'awaiting_review' && data.speech_text) return 'speech_review'
    return 'speech_drafting'
  }
  // speech_approved == true
  if (!data.slides_approved) {
    if (data.status === 'awaiting_review' && data.output_filename) return 'slides_review'
    if (data.status === 'done') return 'done'
    return 'slides_drafting'
  }
  return 'done'
}

// ── Mini-stepper для include_speech ──────────────────────────────────────────

function StageStepper({ stage, data }) {
  const steps = [
    { id: 'speech_drafting', label: '1. Текст', doneIf: data.speech_approved },
    { id: 'slides_drafting', label: '2. Слайды', doneIf: data.slides_approved },
    { id: 'done',            label: '3. Готово', doneIf: stage === 'done' },
  ]
  return (
    <ol className="flex items-center gap-2 mb-8 text-xs">
      {steps.map((s, i) => {
        const done = s.doneIf
        const active =
          (s.id === 'speech_drafting' && (stage === 'speech_drafting' || stage === 'speech_review')) ||
          (s.id === 'slides_drafting' && (stage === 'slides_drafting' || stage === 'slides_review')) ||
          (s.id === 'done' && stage === 'done')
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full border font-medium ${
                done
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : active
                    ? 'bg-brand-600/15 border-brand-500/40 text-brand-300'
                    : 'bg-[#1A1712] border-[#2E2820] text-[#7A7362]'
              }`}
            >
              {done ? '✓ ' : ''}{s.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden="true" className="text-[#2E2820]">—</span>}
          </li>
        )
      })}
    </ol>
  )
}

// ── Subviews ─────────────────────────────────────────────────────────────────

function BigSpinner({ title, sub }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-16">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-t-brand-500 animate-spin" />
      </div>
      <div>
        <p className="text-white font-bold text-xl mb-1">{title}</p>
        <p className="text-brand-400 font-medium text-sm min-h-[1.5rem]">{sub}</p>
      </div>
      <p className="text-[#7A7362] text-xs">Обычно занимает 30–120 секунд</p>
    </div>
  )
}

function SpeechReview({ text, used, max, onApprove, onRegenerate, approving, regenerating }) {
  const left = max - used
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Шаг 1: Текст выступления</h2>
          <p className="text-[#B8AE97] text-sm">
            Прочитайте и примите, либо попросите переделать. После approve будем строить слайды.
          </p>
        </div>
        <span className="text-xs text-[#7A7362] bg-[#1A1712] border border-[#2E2820] px-2.5 py-1 rounded-full tabular-nums shrink-0">
          Правок: {used} / {max}
        </span>
      </div>

      <pre className="card rounded-2xl p-5 text-sm font-mono text-[#B8AE97] whitespace-pre-wrap break-words max-h-[65vh] overflow-auto leading-relaxed">
        {text}
      </pre>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={left <= 0 || regenerating || approving}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#1A1712] hover:bg-[#221E17] text-[#B8AE97] border border-[#2E2820] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {regenerating && <Spinner size="sm" />}
          Переделать {left > 0 ? `(осталось ${left})` : '(лимит)'}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || regenerating}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-[#0F0E0B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0E0B]"
        >
          {approving && <Spinner size="sm" />}
          Принять текст и собрать слайды →
        </button>
      </div>
    </div>
  )
}

function SlidesReview({ plan, orderId, previewCount, used, max, onApprove, onRegenerate, approving, regenerating }) {
  const left = max - used
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Шаг 2: Предпросмотр презентации</h2>
          <p className="text-[#B8AE97] text-sm">
            Проверьте страницы. Можно пересобрать или утвердить и скачать .pptx.
          </p>
        </div>
        <span className="text-xs text-[#7A7362] bg-[#1A1712] border border-[#2E2820] px-2.5 py-1 rounded-full tabular-nums shrink-0">
          Правок: {used} / {max}
        </span>
      </div>

      <SlidePreview plan={plan} orderId={orderId} previewCount={previewCount} />

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={left <= 0 || regenerating || approving}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#1A1712] hover:bg-[#221E17] text-[#B8AE97] border border-[#2E2820] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {regenerating && <Spinner size="sm" />}
          Пересобрать {left > 0 ? `(осталось ${left})` : '(лимит)'}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || regenerating}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-[#0F0E0B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0E0B]"
        >
          {approving && <Spinner size="sm" />}
          Принять и скачать
        </button>
      </div>
    </div>
  )
}

function DoneView({ orderId, data, onNew }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-10">
      <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
        <svg aria-hidden="true" className="w-9 h-9 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-white font-bold text-xl mb-1">Готово!</p>
        <p className="text-[#B8AE97] text-sm">
          Скачайте .pptx и — если выбирали — текст выступления в .md
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <a
          href={filesApi.downloadUrl(orderId)}
          className="flex items-center gap-2.5 bg-brand-500 hover:bg-brand-400 text-[#0F0E0B] font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-brand-900/30"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Скачать .pptx
        </a>
        {data.speech_text && <SpeechDownloadButton orderId={orderId} />}
      </div>
      <button
        onClick={onNew}
        className="text-sm text-[#7A7362] hover:text-[#B8AE97] transition-colors"
      >
        Создать ещё →
      </button>

      <TechnicalPromptInspector data={data} />
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
    } catch (e) {
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
      title={busy ? 'Готовим текст с разметкой по слайдам…' : 'Скачать текст выступления'}
      className="flex items-center gap-2.5 bg-[#1A1712] hover:bg-[#221E17] text-[#B8AE97] hover:text-white font-medium px-5 py-3 rounded-xl border border-[#2E2820] hover:border-[#4A402F] transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {busy ? (
        <>
          <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Готовим текст…
        </>
      ) : (
        <>
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          </svg>
          Скачать текст .md
        </>
      )}
    </button>
  )
}

function TechnicalPromptInspector({ data }) {
  const [openKind, setOpenKind] = useState(null) // 'speech' | 'slides' | null
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
    <div className="mt-6 w-full max-w-xl text-left">
      <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#7A7362] mb-2">
        Технические промты
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {hasSpeech && (
          <button
            onClick={() => setOpenKind(openKind === 'speech' ? null : 'speech')}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono border transition-colors ${
              openKind === 'speech'
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'bg-[#1A1712] border-[#2E2820] text-[#B8AE97] hover:border-[#4A402F]'
            }`}
          >
            Промт текста выступления
          </button>
        )}
        {hasSlides && (
          <button
            onClick={() => setOpenKind(openKind === 'slides' ? null : 'slides')}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono border transition-colors ${
              openKind === 'slides'
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'bg-[#1A1712] border-[#2E2820] text-[#B8AE97] hover:border-[#4A402F]'
            }`}
          >
            Промт слайдов
          </button>
        )}
      </div>

      {openKind === 'speech' && (
        <PromptPanel
          title="Текст выступления — system + user + pseudocode"
          payload={data.speech_prompt}
          onCopy={() => copy(data.speech_prompt)}
        />
      )}
      {openKind === 'slides' && (
        <PromptPanel
          title="Слайды — system + user + pseudocode + raw_response"
          payload={data.generation_prompt}
          onCopy={() => copy(data.generation_prompt)}
        />
      )}
    </div>
  )
}

function PromptPanel({ title, payload, onCopy }) {
  return (
    <div className="rounded-xl border border-[#2E2820] bg-[#1A1712] overflow-auto max-h-[60vh]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2E2820] sticky top-0 bg-[#1A1712] z-10">
        <span className="text-xs font-mono text-[#7A7362]">{title}</span>
        <button onClick={onCopy} className="text-xs text-brand-400 hover:text-brand-300 font-mono">
          Копировать JSON
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-[#B8AE97] whitespace-pre-wrap break-all">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  )
}

function FailedView({ data, onBack }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-10">
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <svg aria-hidden="true" className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <p className="text-white font-bold text-xl mb-1">Ошибка генерации</p>
        {data?.error_message && (
          <p className="text-xs text-[#B8AE97] card rounded-xl p-3 mt-2 font-mono text-left max-w-md">{data.error_message}</p>
        )}
      </div>
      <a href="mailto:support@tezis.app" className="text-brand-400 hover:text-brand-300 text-sm">
        Написать в поддержку
      </a>
      <button onClick={onBack} className="text-sm text-[#7A7362] hover:text-[#B8AE97]">← К заказам</button>
    </div>
  )
}

function RegenerateDialog({ open, onClose, title, note, onNote, placeholder, hint, remaining, onConfirm, confirmLabel }) {
  const canGo = remaining > 0
  return (
    <Modal open={open} onClose={onClose} title={title} labelledBy="regen-title">
      <p className="text-[#B8AE97] text-sm mb-4">
        Опишите, что хотите изменить (можно оставить пустым). Осталось попыток:{' '}
        <span className="tabular-nums font-semibold text-white">{remaining}</span>.
      </p>
      <Textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={5}
        placeholder={placeholder}
        hint={hint}
      />
      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[#B8AE97] hover:text-white hover:bg-[#221E17] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canGo}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-[#0F0E0B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
