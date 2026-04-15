/**
 * Боковой степпер визарда: sticky слева на десктопе, compact-progress наверху
 * на mobile. Шаги 1..N с состояниями done/active/upcoming. Клик переходит
 * только на пройденные шаги (нельзя прыгать вперёд без валидации).
 */
export const STEP_META = [
  { n: 1,  label: 'Тема',         hint: 'О чём презентация' },
  { n: 2,  label: 'Направление',  hint: 'Область работы' },
  { n: 3,  label: 'Тип работы',   hint: 'Диплом / курсовая' },
  { n: 4,  label: 'Объём',        hint: 'Минуты или слайды' },
  { n: 5,  label: 'Детальность',  hint: 'Глубина раскрытия' },
  { n: 6,  label: 'Тезис',        hint: 'Главная идея' },
  { n: 7,  label: 'Учебное заведение',  hint: 'ВУЗ / школа / колледж' },
  { n: 8,  label: 'Элементы',     hint: 'Что должно быть' },
  { n: 9,  label: 'Режим',        hint: 'Ссылки на источники' },
  { n: 10, label: 'Палитра',      hint: 'Цветовая схема' },
]

export default function WizardSidebar({ currentStep, onGoTo, maxReached }) {
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-20">
        <p className="text-xs uppercase tracking-wider text-[#7A7362] font-semibold mb-4">
          Создание презентации
        </p>
        <ol className="flex flex-col gap-1">
          {STEP_META.map((s) => {
            const done = s.n < currentStep
            const active = s.n === currentStep
            const canGo = s.n <= maxReached
            return (
              <li key={s.n}>
                <button
                  type="button"
                  disabled={!canGo}
                  onClick={() => canGo && onGoTo(s.n)}
                  aria-current={active ? 'step' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    active
                      ? 'bg-[#221E17] border border-[#4A402F]'
                      : canGo
                        ? 'hover:bg-[#1A1712] border border-transparent'
                        : 'border border-transparent opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-6 h-6 flex items-center justify-center text-xs rounded-full tabular-nums ${
                      done
                        ? 'bg-brand-600 text-white'
                        : active
                          ? 'bg-brand-500 text-[#0F0E0B] font-bold'
                          : 'bg-[#2E2820] text-[#7A7362]'
                    }`}
                  >
                    {done ? '✓' : s.n}
                  </span>
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className={`text-sm font-medium ${active ? 'text-white' : 'text-[#B8AE97]'}`}>
                      {s.label}
                    </span>
                    <span className="text-xs text-[#7A7362] truncate">{s.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}
