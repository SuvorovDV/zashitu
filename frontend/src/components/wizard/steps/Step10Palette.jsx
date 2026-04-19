import { useWizardStore } from '../../../store/index.js'

// 'auto' — спец-значение: backend сам выберет палитру под тему через Claude.
const AUTO_OPTION = { value: 'auto', label: 'Авто — подберём под тему', isAuto: true }

const PALETTES = [
  { value: 'midnight_executive', label: 'Midnight Executive', primary: '#1E2761', accent: '#CADCFC', light: '#EEF3FB', text: '#1E2761' },
  { value: 'forest_moss',        label: 'Forest & Moss',      primary: '#2C5F2D', accent: '#97BC62', light: '#F5F5F5', text: '#1A3B1B' },
  { value: 'coral_energy',       label: 'Coral Energy',       primary: '#F96167', accent: '#2F3C7E', light: '#FFF5F5', text: '#2F3C7E' },
  { value: 'warm_terracotta',    label: 'Warm Terracotta',    primary: '#B85042', accent: '#A7BEAE', light: '#F0EDE4', text: '#5C2E22' },
  { value: 'ocean_gradient',     label: 'Ocean Gradient',     primary: '#065A82', accent: '#1C7293', light: '#E8F4F8', text: '#065A82' },
  { value: 'charcoal_minimal',   label: 'Charcoal Minimal',   primary: '#36454F', accent: '#212121', light: '#F2F2F2', text: '#212121' },
  { value: 'teal_trust',         label: 'Teal Trust',         primary: '#028090', accent: '#02C39A', light: '#E0F5F5', text: '#015C66' },
  { value: 'berry_cream',        label: 'Berry & Cream',      primary: '#6D2E46', accent: '#A26769', light: '#F5EFE8', text: '#6D2E46' },
  { value: 'sage_calm',          label: 'Sage Calm',          primary: '#50808E', accent: '#84B59F', light: '#F0F7F4', text: '#2C4F57' },
  { value: 'cherry_bold',        label: 'Cherry Bold',        primary: '#990011', accent: '#2F3C7E', light: '#FCF6F5', text: '#2F3C7E' },
]

function SlidePreview({ pal, topic }) {
  return (
    <div
      style={{
        background: pal.light,
        aspectRatio: '16/9',
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        fontSize: 0,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: pal.primary,
          height: '26%',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '6%',
          gap: '3%',
        }}
      >
        <div style={{ width: '2%', height: '50%', background: pal.accent, borderRadius: 2, flexShrink: 0 }} />
        <span style={{
          color: '#fff',
          fontSize: '6px',
          fontWeight: 700,
          fontFamily: 'Arial, sans-serif',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '80%',
        }}>
          {topic || 'Тема работы'}
        </span>
      </div>
      {/* Bullet lines */}
      <div style={{ padding: '5% 6%', display: 'flex', flexDirection: 'column', gap: '8%' }}>
        {[78, 62, 48].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3%' }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: pal.primary, flexShrink: 0, opacity: 0.6 }} />
            <div style={{ height: 3, borderRadius: 2, background: pal.text, opacity: 0.15, width: `${w}%` }} />
          </div>
        ))}
      </div>
      {/* Bottom accent */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6%', background: pal.accent, opacity: 0.25 }} />
    </div>
  )
}

export default function Step10Palette() {
  const { palette, topic, setField } = useWizardStore()
  const autoSelected = palette === 'auto'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Цветовая палитра</h2>
        <p className="text-gray-500 text-sm">Авто-режим — палитру подберёт ИИ под тему. Или выберите вручную.</p>
      </div>

      {/* Авто-карточка — широкая, отдельным блоком сверху. */}
      <button
        onClick={() => setField('palette', AUTO_OPTION.value)}
        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
          autoSelected
            ? 'border-brand-500 bg-brand-500/10'
            : 'border-white/10 bg-white/4 hover:border-white/20'
        }`}
      >
        {/* Мини-радуга 4 цветов как иконка «авто». */}
        <div className="flex gap-1 flex-shrink-0">
          {['#1E2761', '#F96167', '#2C5F2D', '#990011'].map((c) => (
            <div key={c} className="w-3 h-8 rounded-sm" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${autoSelected ? 'text-brand-300' : 'text-white'}`}>
            {AUTO_OPTION.label}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            ИИ выберет палитру под вашу тему перед генерацией
          </div>
        </div>
        {autoSelected && (
          <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <div className="text-xs text-gray-500 -mb-1">или выберите вручную:</div>

      <div className="grid grid-cols-2 gap-3">
        {PALETTES.map((pal) => {
          const selected = palette === pal.value
          return (
            <button
              key={pal.value}
              onClick={() => setField('palette', pal.value)}
              className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-all text-left ${
                selected
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-white/10 bg-white/4 hover:border-white/20'
              }`}
            >
              <SlidePreview pal={pal} topic={topic} />
              <div className="flex items-center gap-2 px-0.5">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pal.primary }}
                />
                <span className={`text-xs font-medium leading-tight truncate ${selected ? 'text-brand-300' : 'text-gray-400'}`}>
                  {pal.label}
                </span>
                {selected && (
                  <svg className="ml-auto w-3.5 h-3.5 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
