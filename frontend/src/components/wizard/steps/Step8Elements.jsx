import { useWizardStore } from '../../../store/index.js'
import Textarea from '../../ui/Textarea.jsx'

const ELEMENTS = ['Введение', 'Цели и задачи', 'Выводы', 'Список источников', 'Список литературы']

export default function Step8Elements() {
  const { required_elements, custom_elements, setField } = useWizardStore()

  function toggle(el) {
    if (required_elements.includes(el)) {
      setField('required_elements', required_elements.filter((e) => e !== el))
    } else {
      setField('required_elements', [...required_elements, el])
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Что обязательно должно быть</h2>
        <p className="text-[#B8AE97] text-sm">
          Отметьте стандартные разделы и допишите свои пожелания — их учтёт и текст, и презентация.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {ELEMENTS.map((el) => {
          const checked = required_elements.includes(el)
          return (
            <label
              key={el}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors select-none ${
                checked ? 'border-brand-500 bg-brand-500/15' : 'card hover:border-[#4A402F]'
              }`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                checked ? 'bg-brand-500 border-brand-500' : 'border-[#4A402F]'
              }`}>
                {checked && (
                  <svg aria-hidden="true" className="w-2.5 h-2.5 text-[#0F0E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input type="checkbox" checked={checked} onChange={() => toggle(el)} className="sr-only" />
              <span className={`text-sm font-medium ${checked ? 'text-brand-300' : 'text-[#B8AE97]'}`}>{el}</span>
            </label>
          )
        })}
      </div>

      <Textarea
        label="Ваши пожелания (свободный текст)"
        hint="Например: «обязательно упомянуть эксперимент с выборкой 200 человек», «сделать акцент на практическом применении»"
        value={custom_elements}
        onChange={(e) => setField('custom_elements', e.target.value)}
        rows={4}
        placeholder="Что именно должно быть отражено в тексте и слайдах"
      />
    </div>
  )
}
