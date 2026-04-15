import { useWizardStore } from '../../../store/index.js'
import Input from '../../ui/Input.jsx'

export default function Step2Direction() {
  const { direction, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Направление / специальность</h2>
        <p className="text-gray-500 text-sm">Опционально. Укажите вашу специальность или направление подготовки</p>
      </div>
      <Input
        label="Направление"
        value={direction}
        onChange={(e) => setField('direction', e.target.value)}
        placeholder="Например: Финансы и кредит, 38.03.01"
      />
    </div>
  )
}
