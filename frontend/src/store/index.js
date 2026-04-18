import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const wizardDefaults = {
  topic: '',
  direction: '',
  work_type: '',
  duration_minutes: 15,
  // null ⇒ кол-во слайдов определяется тарифом; число ⇒ пользователь переопределил.
  slides_count: null,
  detail_level: '',
  thesis: '',
  university: '',
  required_elements: [],
  custom_elements: '',
  mode: '',
  palette: 'midnight_executive',
  tier: 'basic',
  // Опциональный артефакт — Markdown-текст выступления вместе с .pptx.
  include_speech: false,
  // Юзер принёс готовый текст речи — пайплайн пропускает Claude-генерацию.
  speech_is_user_provided: false,
  user_speech_text: '',
  // Юзер разрешил дополнять факты из общих знаний (enhance mode).
  allow_enhance: false,
  // Инфо о докладчике — используется в opener'е речи и в промте.
  presenter_name: '',
  presenter_role: '',
  // Гейт: не раскрывать технические детали реализации.
  skip_tech_details: false,
  // Состояние сессии — НЕ персистим: после ребилда/смены параметров
  // эти значения должны сбрасываться, иначе получаем orphan-заказы.
  currentStep: 1,
  orderId: null,
}

export const useWizardStore = create(
  persist(
    (set, get) => ({
      ...wizardDefaults,

      setField: (field, value) => set({ [field]: value }),

      nextStep: () =>
        set((state) => ({ currentStep: Math.min(state.currentStep + 1, 10) })),

      prevStep: () =>
        set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),

      goToStep: (n) => set({ currentStep: n }),

      setOrderId: (id) => set({ orderId: id }),

      reset: () => set({ ...wizardDefaults }),

      getFormData: () => {
        const s = get()
        // Если пользователь принёс свою речь — значит .md-артефакт точно нужен.
        const includeSpeech = !!s.include_speech || !!s.speech_is_user_provided
        return {
          topic: s.topic,
          direction: s.direction || undefined,
          work_type: s.work_type || undefined,
          duration_minutes: s.duration_minutes,
          slides_count: s.slides_count || undefined,
          detail_level: s.detail_level || undefined,
          thesis: s.thesis || undefined,
          university: s.university || undefined,
          required_elements: s.required_elements.length ? s.required_elements : undefined,
          custom_elements: s.custom_elements?.trim() || undefined,
          mode: s.mode || undefined,
          palette: s.palette || 'midnight_executive',
          tier: s.tier,
          include_speech: includeSpeech,
          speech_is_user_provided: !!s.speech_is_user_provided,
          user_speech_text: s.speech_is_user_provided ? (s.user_speech_text?.trim() || undefined) : undefined,
          allow_enhance: !!s.allow_enhance,
          presenter_name: s.presenter_name?.trim() || undefined,
          presenter_role: s.presenter_role?.trim() || undefined,
          skip_tech_details: !!s.skip_tech_details,
        }
      },
    }),
    {
      name: 'zashitu_wizard_draft_v2',
      storage: createJSONStorage(() => localStorage),
      // Только form-поля — currentStep/orderId не персистятся.
      partialize: (state) => ({
        topic: state.topic,
        direction: state.direction,
        work_type: state.work_type,
        duration_minutes: state.duration_minutes,
        slides_count: state.slides_count,
        detail_level: state.detail_level,
        thesis: state.thesis,
        university: state.university,
        required_elements: state.required_elements,
        custom_elements: state.custom_elements,
        mode: state.mode,
        palette: state.palette,
        tier: state.tier,
        include_speech: state.include_speech,
        speech_is_user_provided: state.speech_is_user_provided,
        user_speech_text: state.user_speech_text,
        allow_enhance: state.allow_enhance,
        presenter_name: state.presenter_name,
        presenter_role: state.presenter_role,
        skip_tech_details: state.skip_tech_details,
      }),
    }
  )
)
