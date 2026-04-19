import { useWizardStore } from '../../../store/index.js'

// Активные типы — отдельные системные промты в backend/generation/prompts/.
// Coming-soon — заморожены в UI, fallback на academic-промт в backend.
const WORK_TYPES = [
  { id: 'Школьный реферат', active: true },
  { id: 'Обычный доклад',   active: true },
  { id: 'ВКР',              active: false },
  { id: 'Курсовая',         active: false },
  { id: 'Семинар',          active: false },
  { id: 'Личный проект',    active: false },
]

export default function Step3WorkType() {
  const { work_type, skip_tech_details, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Тип презентации</h2>
        <p className="text-[#D2CFC1] text-sm">Определяет структуру слайдов и тональность текста</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {WORK_TYPES.map(({ id, active }) => {
          const selected = work_type === id
          if (!active) {
            return (
              <button
                key={id}
                type="button"
                disabled
                aria-disabled="true"
                title="Эта категория появится в одной из ближайших версий"
                className="px-4 py-3 rounded-xl border text-sm font-medium card text-[#5A5A50] border-[#33332C] cursor-not-allowed opacity-60 flex items-center justify-between gap-2"
              >
                <span>{id}</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1A1A18] border border-[#33332C] text-[#8F8C7F]">
                  скоро
                </span>
              </button>
            )
          }
          return (
            <button
              key={id}
              type="button"
              onClick={() => setField('work_type', id)}
              aria-pressed={selected}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                  : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
              }`}
            >
              {id}
            </button>
          )
        })}
      </div>

      {/* Гейт по техническим деталям — актуально для личного проекта, но оставляем всегда. */}
      <label
        className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-colors select-none ${
          skip_tech_details ? 'border-brand-500 bg-brand-500/10' : 'card hover:border-[#4B4A42]'
        }`}
      >
        <div
          className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
            skip_tech_details ? 'bg-brand-500 border-brand-500' : 'border-[#4B4A42]'
          }`}
        >
          {skip_tech_details && (
            <svg aria-hidden="true" className="w-2.5 h-2.5 text-[#0E0E0C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          checked={!!skip_tech_details}
          onChange={(e) => setField('skip_tech_details', e.target.checked)}
          className="sr-only"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white mb-0.5">
            Не углубляться в техническую реализацию
          </p>
          <p className="text-xs text-[#8F8C7F]">
            Полезно, если докладчик — не разработчик. Технические детали (стек, архитектура, БД)
            не попадут ни в текст, ни на слайды.
          </p>
        </div>
      </label>
    </div>
  )
}
