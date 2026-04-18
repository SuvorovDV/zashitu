import { useWizardStore } from '../../../store/index.js'

export default function Step9Mode() {
  const {
    include_speech,
    speech_is_user_provided,
    user_speech_text,
    allow_enhance,
    setField,
  } = useWizardStore()

  const speechLen = (user_speech_text || '').length
  const speechLimit = 40000

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Материалы и наполнение</h2>
        <p className="text-[#D2CFC1] text-sm">
          {include_speech
            ? 'Есть ли у вас готовая речь? Разрешаете ли дополнять информацию?'
            : 'Разрешаете ли дополнять информацию из общих знаний?'}
        </p>
      </div>

      {/* ── У вас есть текст выступления? — только если include_speech=true ─ */}
      {include_speech && (
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-white">У вас уже есть текст выступления?</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setField('speech_is_user_provided', false)
              setField('user_speech_text', '')
            }}
            aria-pressed={!speech_is_user_provided}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              !speech_is_user_provided
                ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
            }`}
          >
            Нет, сгенерируйте
          </button>
          <button
            type="button"
            onClick={() => setField('speech_is_user_provided', true)}
            aria-pressed={!!speech_is_user_provided}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              speech_is_user_provided
                ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
            }`}
          >
            Да, вставлю свою
          </button>
        </div>

        {speech_is_user_provided && (
          <div className="flex flex-col gap-2">
            <textarea
              value={user_speech_text || ''}
              onChange={(e) => setField('user_speech_text', e.target.value.slice(0, speechLimit))}
              placeholder="Вставьте ваш текст выступления… (до 40 000 символов). Поддерживается Markdown — заголовки ##, таблицы, списки."
              rows={10}
              className="textarea"
              style={{ minHeight: 180 }}
            />
            <div className="mono tiny muted flex justify-between">
              <span>{speechLen.toLocaleString('ru-RU')} / {speechLimit.toLocaleString('ru-RU')} симв.</span>
              {speechLen > 0 && speechLen < 500 && (
                <span style={{ color: 'var(--warn)' }}>коротковато для 10-минутного выступления</span>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Разрешаете ли дополнять? ───────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-white">Можем ли мы дополнить информацию?</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setField('allow_enhance', false)}
            aria-pressed={!allow_enhance}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              !allow_enhance
                ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
            }`}
          >
            Строго по источнику
          </button>
          <button
            type="button"
            onClick={() => setField('allow_enhance', true)}
            aria-pressed={!!allow_enhance}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              allow_enhance
                ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                : 'card text-[#D2CFC1] hover:border-[#4B4A42] hover:text-white'
            }`}
          >
            Разрешаю дополнить
          </button>
        </div>
        <p className="text-xs text-[#8F8C7F] leading-relaxed">
          {allow_enhance
            ? 'Claude добавит факты из общих знаний (статистика, контекст), где у вашей работы есть пробелы. Такие тезисы помечены «общее знание» — научрук видит, что взято не из работы.'
            : 'Каждый тезис — строго из вашей работы/речи, со ссылкой на страницу. Ничего извне.'}
        </p>
      </div>
    </div>
  )
}
