import { useWizardStore } from '../../../store/index.js'

const MODES = [
  {
    value: 'source_grounded',
    label: 'По работе',
    desc: 'Каждый тезис берётся из вашей работы — со ссылкой на страницу. Никаких галлюцинаций.',
    badge: 'Рекомендуем',
  },
  {
    value: 'no_template',
    label: 'Свободный',
    desc: 'ИИ генерирует контент свободно, опираясь на загруженную работу как контекст.',
  },
]

export default function Step9Mode() {
  const { mode, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Режим генерации</h2>
        <p className="text-gray-500 text-sm">Как именно создавать содержимое слайдов</p>
      </div>
      <div className="flex flex-col gap-3">
        {MODES.map(({ value, label, desc, badge }) => (
          <button
            key={value}
            onClick={() => setField('mode', value)}
            className={`px-4 py-4 rounded-xl border text-left transition-all ${
              mode === value
                ? 'border-brand-500 bg-brand-500/15'
                : 'border-white/10 bg-white/4 hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-medium text-sm ${mode === value ? 'text-brand-300' : 'text-white'}`}>{label}</span>
              {badge && (
                <span className="text-xs bg-brand-600/80 text-brand-200 px-2 py-0.5 rounded-full font-medium">{badge}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
