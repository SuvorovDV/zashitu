import { useWizardStore } from '../../../store/index.js'
import Input from '../../ui/Input.jsx'

export default function Step7University() {
  const { university, setField } = useWizardStore()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Укажите учебное заведение</h2>
        <p className="text-[#D2CFC1] text-sm">Опционально. Название попадёт на титульный слайд</p>
      </div>
      <Input
        label="Учебное заведение"
        value={university}
        onChange={(e) => setField('university', e.target.value)}
        placeholder="Например: НИУ ВШЭ, МГУ, колледж №5, гимназия №1"
      />
    </div>
  )
}
