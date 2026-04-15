import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizardStore } from '../store/index.js'
import { ordersApi } from '../api/index.js'
import { useToast } from '../components/ui/Toast.jsx'
import { minTierFor } from '../lib/tiers.js'
import WizardProgress from '../components/wizard/WizardProgress.jsx'
import WizardSidebar from '../components/wizard/WizardSidebar.jsx'
import FileUpload from '../components/ui/FileUpload.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { ru } from '../shared/i18n/ru.js'

const STEPS = [
  lazy(() => import('../components/wizard/steps/Step1Topic.jsx')),
  lazy(() => import('../components/wizard/steps/Step2Direction.jsx')),
  lazy(() => import('../components/wizard/steps/Step3WorkType.jsx')),
  lazy(() => import('../components/wizard/steps/Step4Duration.jsx')),
  lazy(() => import('../components/wizard/steps/Step5Detail.jsx')),
  lazy(() => import('../components/wizard/steps/Step6Thesis.jsx')),
  lazy(() => import('../components/wizard/steps/Step7University.jsx')),
  lazy(() => import('../components/wizard/steps/Step8Elements.jsx')),
  lazy(() => import('../components/wizard/steps/Step9Mode.jsx')),
  lazy(() => import('../components/wizard/steps/Step10Palette.jsx')),
]

function canProceed(step, store) {
  if (step === 1) return store.topic.trim().length > 0
  return true
}

export default function Wizard() {
  const navigate = useNavigate()
  const toast = useToast()
  const store = useWizardStore()
  const { currentStep, nextStep, prevStep, goToStep, getFormData, setOrderId, orderId,
          slides_count, duration_minutes, detail_level, tier, setField } = store

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [maxReached, setMaxReached] = useState(currentStep)
  const contentRef = useRef(null)

  // Централизованный авто-синк минимально подходящего тарифа под все выборы пользователя.
  const requiredTier = minTierFor({
    slides_count,
    duration_minutes: slides_count ? null : duration_minutes,
    detail_level,
  })
  useEffect(() => {
    if (tier !== requiredTier) setField('tier', requiredTier)
  }, [requiredTier])

  useEffect(() => {
    setMaxReached((m) => Math.max(m, currentStep))
  }, [currentStep])

  useEffect(() => {
    // Фокус на первом интерактивном элементе шага — помогает клавиатуре.
    const el = contentRef.current?.querySelector('input,textarea,select,button')
    el?.focus?.({ preventScroll: true })
  }, [currentStep])

  const StepComponent = STEPS[currentStep - 1]
  const isLast = currentStep === 10
  const ok = canProceed(currentStep, store)

  async function handleNext() {
    if (!ok) return
    if (isLast) {
      setSubmitting(true)
      setError(null)
      try {
        const res = await ordersApi.create(getFormData())
        const newOrderId = res.data.id
        setOrderId(newOrderId)
        navigate(`/payment?order_id=${newOrderId}`)
      } catch (e) {
        const msg =
          e.code === 'ERR_NETWORK'
            ? ru.common.networkError
            : e.response?.data?.detail || ru.wizard.orderFailed
        setError(msg)
        toast.error(msg)
      } finally {
        setSubmitting(false)
      }
    } else {
      nextStep()
    }
  }

  function handleKey(e) {
    // Enter → Далее, кроме textarea (там allow newlines).
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleNext()
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10" onKeyDown={handleKey}>
      <div className="flex gap-10">
        <WizardSidebar currentStep={currentStep} onGoTo={goToStep} maxReached={maxReached} />

        <div className="flex-1 min-w-0 pb-24">
          {/* Mobile progress */}
          <div className="lg:hidden">
            <WizardProgress currentStep={currentStep} />
          </div>

          <div className="card rounded-2xl p-7 mb-5" ref={contentRef}>
            <Suspense fallback={<div className="flex justify-center py-10"><Spinner size="md" /></div>}>
              <div key={currentStep} className="animate-[fadeUp_200ms_ease-out]">
                <StepComponent />
              </div>
            </Suspense>

            {currentStep >= 2 && orderId && (
              <div className="mt-6 border-t border-[#2E2820] pt-6">
                <p className="text-sm font-medium text-[#B8AE97] mb-3">
                  Загрузить файл работы (PDF или DOCX)
                </p>
                <FileUpload orderId={orderId} />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-400 mb-4 text-center">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#0F0E0B]/90 backdrop-blur-lg border-t border-[#2E2820]">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1 || submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#1A1712] hover:bg-[#221E17] text-[#B8AE97] border border-[#2E2820] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            ← {ru.wizard.back}
          </button>
          <div className="hidden sm:block text-xs text-[#7A7362] tabular-nums">
            Шаг {currentStep} из 10
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={!ok || submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-[#0F0E0B] shadow-lg shadow-brand-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0E0B]"
          >
            {submitting && <Spinner size="sm" />}
            {isLast ? ru.wizard.createOrder : `${ru.wizard.next} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
