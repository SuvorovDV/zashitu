import { useWizardStore } from '../../../store/index.js'

export default function Step6Thesis() {
  const { thesis, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Главный тезис</h2>
        <p className="text-gray-500 text-sm">Опционально. Основная мысль или вывод вашей работы в 1–3 предложениях</p>
      </div>
      <textarea
        value={thesis}
        onChange={(e) => setField('thesis', e.target.value)}
        rows={4}
        placeholder="Например: Цифровизация банковского сектора повышает операционную эффективность, однако несёт риски кибербезопасности..."
        className="px-3.5 py-2.5 rounded-xl text-sm bg-white/6 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none hover:border-white/20 transition"
      />
    </div>
  )
}
