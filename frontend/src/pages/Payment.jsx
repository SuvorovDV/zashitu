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
import Textarea from '../components/ui/Textarea.jsx'

function formatRub(n) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
}

/**
 * Карточка выбранного (в визарде) тарифа. Прибита сверху формы оплаты —
 * пользователь не перебирает, а видит, что получит.
 */
function SelectedTierCard({ tier, include_speech }) {
  if (!tier) return null
  return (
    <div className="mb-5 rounded-2xl border border-brand-500/50 bg-brand-500/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-400 mb-1.5">
            Ваш тариф
          </p>
          <p className="text-white font-bold text-lg">{tier.label}</p>
          <p className="text-[#B8AE97] text-xs mt-1">
            До {tier.max_slides} слайдов · до {tier.max_duration_minutes} мин
            {' · '}{tier.id === 'premium' ? 'Premium-модель' : 'Стандартная модель'}
          </p>
          <p className="text-[#7A7362] text-xs mt-1">
            Формат: {include_speech ? 'презентация + текст выступления' : 'только презентация'}
          </p>
        </div>
        <div className="text-3xl font-bold text-white tabular-nums shrink-0">
          {formatRub(tier.price_rub)}
        </div>
      </div>
    </div>
  )
}

// Списки преимуществ апгрейда: ключ — «откуда → куда».
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

function UpgradeOptions({ tiers, current, onChoose }) {
  const currentOrder = tiers[current]?.order ?? 0
  const higher = Object.values(tiers)
    .filter((t) => (t.order ?? 0) > currentOrder)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (!higher.length) return null

  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#7A7362] mb-3 px-1">
        Хотите больше?
      </p>
      <div className="flex flex-col gap-2.5">
        {higher.map((t) => {
          const key = `${current}->${t.id}`
          const benefits = UPGRADE_BENEFITS[key] || []
          const delta = t.price_rub - (tiers[current]?.price_rub ?? 0)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChoose(t.id)}
              className="text-left card rounded-xl px-4 py-3.5 hover:bg-[#221E17] hover:border-[#4A402F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{t.label}</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brand-300 bg-brand-600/15 border border-brand-500/25 px-1.5 py-0.5 rounded">
                    Апгрейд
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white tabular-nums">{formatRub(t.price_rub)}</div>
                  {delta > 0 && (
                    <div className="text-[11px] text-[#7A7362] tabular-nums">+{formatRub(delta)}</div>
                  )}
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-xs text-[#B8AE97]">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3 h-3 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Payment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const orderId = params.get('order_id')
  const cancelled = params.get('cancelled') === '1'
  const isDev = useDevMode()

  const { tier, include_speech, slides_count, duration_minutes, mode, custom_elements, setField } = useWizardStore()
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

  // Если текущий selectedTier не справится с выбранным объёмом — поднимем до минимального подходящего.
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
      <div className="text-center py-24 text-[#7A7362]">
        {ru.payment.orderNotFound}{' '}
        <Link to="/wizard" className="text-brand-400 hover:text-brand-300">Создать новый</Link>
      </div>
    )
  }

  const selected = tiers?.[selectedTier]

  return (
    <div className="max-w-lg mx-auto px-5 py-12">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white mb-1">{ru.payment.title}</h1>
        <p className="text-[#7A7362] text-sm">{ru.payment.subtitle}</p>
      </div>

      {cancelled && (
        <div className="mb-5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-400">
          {ru.payment.cancelled}
        </div>
      )}

      {isDev && (
        <div className="mb-5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-semibold text-sm">{ru.payment.devMode}</span>
            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">DEV</span>
          </div>
          <p className="text-amber-500/80 text-xs mb-3">
            Stripe не подключён. Симулировать оплату и запустить генерацию:
          </p>
          <button
            onClick={handleDevPay}
            disabled={devLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg border border-amber-500/25 transition-all disabled:opacity-50"
          >
            {devLoading && <Spinner size="sm" />}
            {ru.payment.devSim}
          </button>
        </div>
      )}

      {/* Режим «По работе» (source_grounded) требует файл; «Свободный» — нет. */}
      {mode !== 'no_template' && (
        <div className="card rounded-2xl p-5 mb-4">
          <h2 className="font-medium text-white text-sm mb-1">Загрузите файл работы</h2>
          <p className="text-xs text-[#7A7362] mb-3">
            PDF или DOCX. Каждый тезис получит ссылку на страницу источника.
          </p>
          <FileUpload orderId={orderId} />
        </div>
      )}

      <div className="card rounded-2xl p-5 mb-5">
        <Textarea
          label="Что обязательно должно быть"
          hint={mode === 'no_template'
            ? 'Свободный режим: подробно распишите, что должно быть в тексте и слайдах.'
            : 'Дополнительные пожелания к содержанию — учтём вместе с файлом.'}
          value={custom_elements || ''}
          onChange={(e) => setField('custom_elements', e.target.value)}
          rows={4}
          placeholder="Например: обязательно упомянуть эксперимент; сделать акцент на практическом применении"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : tiers ? (
        <>
          <SelectedTierCard tier={selected} include_speech={include_speech} />
          <UpgradeOptions
            tiers={tiers}
            current={selectedTier}
            onChoose={setSelectedTier}
          />
        </>
      ) : null}

      {error && <p role="alert" aria-live="polite" className="text-sm text-red-400 mb-4 text-center">{error}</p>}

      <button
        onClick={handlePay}
        disabled={loading || !selectedTier || isLoading}
        className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition-all shadow-xl shadow-brand-900/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Spinner size="sm" />}
        Оплатить
        {selected ? ` — ${formatRub(selected.price_rub)}` : ''}
      </button>
    </div>
  )
}
