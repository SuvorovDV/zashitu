import { useWizardStore } from '../../../store/index.js'

const LEVELS = [
  { value: 'brief',    label: 'Краткий',   desc: 'Только ключевые тезисы, минимум текста' },
  { value: 'standard', label: 'Стандарт',  desc: 'Баланс между содержательностью и лаконичностью' },
  {
    value: 'detailed',
    label: 'Подробный',
    desc: 'Развёрнутые пояснения и детали на каждом слайде',
    requiresPremium: true,
  },
]

export default function Step5Detail() {
  const { detail_level, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Уровень детализации</h2>
        <p className="text-[#D2CFC1] text-sm">Насколько подробными должны быть слайды</p>
      </div>
      <div className="flex flex-col gap-3">
        {LEVELS.map(({ value, label, desc, requiresPremium }) => {
          const selected = detail_level === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setField('detail_level', value)}
              aria-pressed={selected}
              className={`px-4 py-3.5 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-500 bg-brand-500/15'
                  : 'card hover:border-[#4B4A42]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`font-medium text-sm ${selected ? 'text-brand-300' : 'text-white'}`}>
                  {label}
                </span>
                {requiresPremium && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brand-300 bg-brand-600/15 border border-brand-500/30 px-1.5 py-0.5 rounded">
                    Только Премиум
                  </span>
                )}
              </div>
              <div className="text-xs text-[#8F8C7F]">{desc}</div>
              {requiresPremium && selected && (
                <p className="text-[11px] text-brand-400 mt-1.5">
                  Тариф автоматически повышен до Премиум (399 ₽).
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
