const TOTAL = 10

export default function WizardProgress({ currentStep }) {
  const pct = Math.round((currentStep / TOTAL) * 100)
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Шаг {currentStep} <span className="text-gray-600">из {TOTAL}</span></span>
        <span className="text-xs text-gray-600">{pct}%</span>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-white/8 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step dots — compact */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => {
          const step = i + 1
          const done = step < currentStep
          const active = step === currentStep
          return (
            <div
              key={step}
              className={`transition-all duration-300 rounded-full ${
                active
                  ? 'w-5 h-2 bg-brand-500'
                  : done
                  ? 'w-2 h-2 bg-brand-700'
                  : 'w-2 h-2 bg-white/10'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
