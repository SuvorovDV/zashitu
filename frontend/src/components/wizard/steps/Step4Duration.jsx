import { useWizardStore } from '../../../store/index.js'
import { TIER_LIMITS, minTierFor } from '../../../lib/tiers.js'

// Общий верхний предел — максимум из всех тарифов (премиум).
const MAX_SLIDES = Math.max(...Object.values(TIER_LIMITS).map((t) => t.max_slides))
const MAX_DURATION = Math.max(...Object.values(TIER_LIMITS).map((t) => t.max_duration_minutes))

export default function Step4Duration() {
  const { duration_minutes, slides_count, detail_level, setField } = useWizardStore()

  const mode = slides_count ? 'slides' : 'duration'
  const durationValue = duration_minutes || 15
  const slidesValue = slides_count || 15

  // Тариф авто-синкается в Wizard.jsx; здесь просто показываем минимально подходящий.
  const requiredTier = minTierFor({
    slides_count: mode === 'slides' ? slidesValue : null,
    duration_minutes: mode === 'duration' ? durationValue : null,
    detail_level,
  })
  const tierInfo = TIER_LIMITS[requiredTier]

  function switchTo(m) {
    if (m === 'slides') {
      if (!slides_count) setField('slides_count', slidesValue)
    } else {
      setField('slides_count', null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Объём презентации</h2>
        <p className="text-[#B8AE97] text-sm">
          Укажите длительность выступления или точное количество слайдов — что удобнее.
        </p>
      </div>

      <div role="tablist" aria-label="Способ задания объёма" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0F0E0B] border border-[#2E2820]">
        {[
          { id: 'duration', label: 'По длительности' },
          { id: 'slides',   label: 'По кол-ву слайдов' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => switchTo(m.id)}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              mode === m.id ? 'bg-brand-500 text-[#0F0E0B]' : 'text-[#B8AE97] hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'duration' ? (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <span className="text-4xl font-bold text-brand-400 tabular-nums">{durationValue}</span>
            <span className="text-[#7A7362] ml-1.5 text-lg">мин</span>
          </div>
          <input
            type="range"
            min={5}
            max={MAX_DURATION}
            step={5}
            value={durationValue}
            onChange={(e) => setField('duration_minutes', Number(e.target.value))}
            className="w-full accent-brand-500 h-1.5 cursor-pointer"
            aria-label="Длительность выступления в минутах"
          />
          <TierMarks type="duration" value={durationValue} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <span className="text-4xl font-bold text-brand-400 tabular-nums">{slidesValue}</span>
            <span className="text-[#7A7362] ml-1.5 text-lg">слайдов</span>
          </div>
          <input
            type="range"
            min={6}
            max={MAX_SLIDES}
            step={1}
            value={slidesValue}
            onChange={(e) => setField('slides_count', Number(e.target.value))}
            className="w-full accent-brand-500 h-1.5 cursor-pointer"
            aria-label="Количество слайдов"
          />
          <TierMarks type="slides" value={slidesValue} />
        </div>
      )}

      {/* Подсказка о тарифе */}
      <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#7A7362] mb-0.5">Этому объёму соответствует тариф</p>
          <p className="text-white font-semibold text-sm">{tierInfo.label}</p>
        </div>
        <span className="text-brand-300 font-bold text-lg tabular-nums">
          {new Intl.NumberFormat('ru-RU').format(tierInfo.price_rub)} ₽
        </span>
      </div>
    </div>
  )
}

function TierMarks({ type, value }) {
  // Порог начала каждого тарифа — показываем на оси в виде засечек.
  const marks = []
  if (type === 'slides') {
    marks.push({ at: TIER_LIMITS.basic.max_slides,    label: 'Базовый' })
    marks.push({ at: TIER_LIMITS.standard.max_slides, label: 'Стандарт' })
    marks.push({ at: TIER_LIMITS.premium.max_slides,  label: 'Премиум' })
  } else {
    marks.push({ at: TIER_LIMITS.basic.max_duration_minutes,    label: 'Базовый' })
    marks.push({ at: TIER_LIMITS.standard.max_duration_minutes, label: 'Стандарт' })
    marks.push({ at: TIER_LIMITS.premium.max_duration_minutes,  label: 'Премиум' })
  }

  return (
    <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold">
      {marks.map((m) => {
        const active = value <= m.at && (marks.indexOf(m) === 0 || value > marks[marks.indexOf(m) - 1].at)
        return (
          <span
            key={m.label}
            className={`tabular-nums ${active ? 'text-brand-400' : 'text-[#7A7362]'}`}
          >
            {m.label}
            <span aria-hidden="true" className="block text-[#7A7362] font-normal normal-case tracking-normal">
              ≤ {m.at}
            </span>
          </span>
        )
      })}
    </div>
  )
}
