import { useWizardStore } from '../../../store/index.js'

const WORK_TYPES = [
  'ВКР',
  'Курсовая',
  'Школьный реферат',
  'Семинар',
  'Личный проект',
]

export default function Step3WorkType() {
  const { work_type, skip_tech_details, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Тип работы</h2>
        <p className="text-[#D2CFC1] text-sm">Определяет тональность текста и наличие иллюстраций</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {WORK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setField('work_type', type)}
            aria-pressed={work_type === type}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              work_type === type
                ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
            }`}
          >
            {type}
          </button>
        ))}
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
