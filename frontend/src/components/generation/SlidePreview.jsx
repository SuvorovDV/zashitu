import { filesApi } from '../../api/index.js'

/**
 * Pixel-perfect превью презентации: PNG-рендер слайдов через LibreOffice.
 * Если рендер почему-то не удался (preview_count=0), показываем fallback —
 * структурный HTML-рендер плана слайдов.
 */
export default function SlidePreview({ plan, orderId, previewCount = 0 }) {
  const hasImages = orderId && previewCount > 0

  if (hasImages) {
    return (
      <div className="w-full max-w-3xl">
        <PreviewHeader plan={plan} previewCount={previewCount} />
        <ol className="flex flex-col gap-4">
          {Array.from({ length: previewCount }, (_, i) => (
            <li
              key={i + 1}
              className="relative rounded-xl overflow-hidden border border-[#33332C] bg-[#0E0E0C] shadow-lg shadow-black/30"
            >
              <span
                aria-hidden="true"
                className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-mono tabular-nums backdrop-blur-sm"
              >
                {i + 1} / {previewCount}
              </span>
              <img
                src={filesApi.previewUrl(orderId, i + 1)}
                alt={`Слайд ${i + 1}`}
                loading="lazy"
                className="block w-full h-auto"
              />
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // ── Fallback: структурный рендер плана слайдов ────────────────────────────
  if (!plan?.slides?.length) return null
  const palette = plan.palette || 'midnight_executive'
  return (
    <div className="w-full max-w-3xl">
      <PreviewHeader plan={plan} />
      <p className="text-[11px] text-yellow-400/80 mb-3 px-1">
        Pixel-perfect превью ещё не готово — показываем структуру.
      </p>
      <ol className="flex flex-col gap-3">
        {plan.slides.map((slide, i) => (
          <li key={i} className="card rounded-xl p-4 flex gap-4">
            <span
              aria-hidden="true"
              className="shrink-0 w-8 h-8 rounded-lg bg-[#23231E] border border-[#4B4A42] text-[#8F8C7F] text-xs font-semibold flex items-center justify-center tabular-nums"
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="text-white font-semibold text-sm leading-snug">{slide.title}</h4>
                <span className="text-[10px] uppercase tracking-wider text-[#8F8C7F] bg-[#23231E] px-1.5 py-0.5 rounded">
                  {slide.layout}
                </span>
              </div>
              <SlideBody slide={slide} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function PreviewHeader({ plan, previewCount }) {
  if (!plan) return null
  const n = previewCount || plan.slides?.length || '—'
  return (
    <div className="flex items-center justify-between text-xs text-[#8F8C7F] mb-3 px-1">
      <span>
        {n} слайдов · {plan.tier_label || plan.tier} · палитра {plan.palette}
      </span>
      <span className="tabular-nums">{plan.duration_minutes ?? '—'} мин</span>
    </div>
  )
}

function SlideBody({ slide }) {
  if (slide.layout === 'section') {
    return <p className="text-brand-300 text-sm italic">{slide.subtitle || '—'}</p>
  }
  if (slide.layout === 'callout') {
    return (
      <div className="flex flex-col gap-2">
        {slide.callout && (
          <blockquote className="border-l-2 border-brand-500 pl-3 text-[#F5F3EC] text-sm italic">
            {slide.callout}
          </blockquote>
        )}
        {slide.bullets?.length > 0 && (
          <ul className="list-disc list-inside text-[#D2CFC1] text-sm space-y-1">
            {slide.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
    )
  }
  if (slide.layout === 'two_col') {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {(slide.columns || []).map((col, i) => (
          <div key={i} className="bg-[#0E0E0C] rounded-lg p-3 border border-[#33332C]">
            {col.heading && <p className="text-white text-xs font-semibold mb-1.5">{col.heading}</p>}
            <ul className="list-disc list-inside text-[#D2CFC1] text-xs space-y-1">
              {(col.bullets || []).map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          </div>
        ))}
      </div>
    )
  }
  return (
    <ul className="list-disc list-inside text-[#D2CFC1] text-sm space-y-1">
      {(slide.bullets || []).map((b, i) => <li key={i}>{b}</li>)}
      {slide.source_ref && (
        <li className="list-none text-[11px] text-[#8F8C7F] italic mt-1.5">{slide.source_ref}</li>
      )}
    </ul>
  )
}
