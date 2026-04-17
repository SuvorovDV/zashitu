import { useWizardStore } from '../../../store/index.js'
import Input from '../../ui/Input.jsx'

const MODES = [
  {
    id: false,
    title: 'Только презентация',
    desc: 'Сгенерируем .pptx на основе ваших материалов.',
  },
  {
    id: true,
    title: 'Презентация + текст выступления',
    desc: 'Markdown-текст для защиты (5–15 минут) + синхронизированные слайды.',
    badge: 'Новинка',
  },
]

export default function Step1Topic() {
  const { topic, include_speech, presenter_name, presenter_role, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Что вам нужно</h2>
        <p className="text-[#D2CFC1] text-sm">Выберите формат работы — на втором экране подберём тему</p>
      </div>

      <div className="grid gap-2.5">
        {MODES.map((m) => {
          const selected = !!include_speech === m.id
          return (
            <button
              key={String(m.id)}
              type="button"
              onClick={() => setField('include_speech', m.id)}
              aria-pressed={selected}
              className={`text-left rounded-xl border px-4 py-3.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-[#33332C] bg-[#1A1A16] hover:border-[#4B4A42]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-4 h-4 rounded-full border flex-shrink-0 ${selected ? 'border-brand-400 bg-brand-500' : 'border-[#4B4A42]'}`}>
                  {selected && (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-full h-full text-[#0E0E0C]">
                      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </span>
                <span className={`font-semibold text-sm ${selected ? 'text-white' : 'text-[#D2CFC1]'}`}>
                  {m.title}
                </span>
                {m.badge && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brand-300 bg-brand-600/20 border border-brand-500/30 px-1.5 py-0.5 rounded">
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8F8C7F] pl-6">{m.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="border-t border-[#33332C] pt-6">
        <Input
          label="Тема работы"
          hint="Введите точную тему — так, как она написана в задании"
          value={topic}
          onChange={(e) => setField('topic', e.target.value)}
          placeholder="Например: Анализ влияния цифровизации на банковский сектор"
          autoFocus
        />
      </div>

      {/* Информация о докладчике — опциональна, но сильно улучшает опенер речи. */}
      <details className="rounded-xl border border-[#33332C] bg-[#1A1A16]">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[#D2CFC1] hover:text-white transition-colors">
          Информация о докладчике (опционально)
        </summary>
        <div className="px-4 pb-4 pt-1 grid sm:grid-cols-2 gap-3">
          <Input
            label="Имя"
            value={presenter_name}
            onChange={(e) => setField('presenter_name', e.target.value)}
            placeholder="Например: Алексей Севрюков"
          />
          <Input
            label="Роль / специализация"
            value={presenter_role}
            onChange={(e) => setField('presenter_role', e.target.value)}
            placeholder="Например: студент-продакт"
          />
        </div>
        <p className="text-xs text-[#8F8C7F] px-4 pb-4">
          Используется в открытии выступления: «Здравствуйте, меня зовут…».
        </p>
      </details>
    </div>
  )
}
