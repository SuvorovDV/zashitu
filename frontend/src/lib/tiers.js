// Локальная копия лимитов тарифов — синхронизирована с backend/config.py.
// Для надёжного UX используем её, пока /payments/tiers ещё не загрузился;
// после загрузки API эти значения заменяются полученными.
export const TIER_ORDER = ['basic', 'standard', 'premium']

export const TIER_LIMITS = {
  basic:    { label: 'Базовый',  max_slides: 12, max_duration_minutes: 15, price_rub: 99 },
  standard: { label: 'Стандарт', max_slides: 20, max_duration_minutes: 25, price_rub: 199 },
  premium:  { label: 'Премиум',  max_slides: 30, max_duration_minutes: 45, price_rub: 399 },
}

// Школьный реферат: премиум недоступен (зеркалит backend/orders/service.py).
// Opus + 30 слайдов + 45 мин — overkill для школы, базового/стандарта хватает.
function tierAllowedForWorkType(tierId, work_type) {
  if (tierId === 'premium' && (work_type || '').trim() === 'Школьный реферат') return false
  return true
}

/**
 * Возвращает id минимального тарифа, который поддерживает заданный объём.
 * Если передать оба ограничения — берётся более строгое.
 *
 * Fallback: если ни один тариф не помещает объём (например школьный реферат
 * с persisted slides_count=30), возвращаем последний РАЗРЕШЁННЫЙ для work_type
 * — иначе UI отдал бы premium, который backend сразу бы отверг.
 */
export function minTierFor({ slides_count, duration_minutes, detail_level, work_type }, tiers = TIER_LIMITS) {
  for (const id of TIER_ORDER) {
    const t = tiers[id]
    if (!t) continue
    if (!tierAllowedForWorkType(id, work_type)) continue
    if (slides_count && slides_count > t.max_slides) continue
    if (duration_minutes && duration_minutes > t.max_duration_minutes) continue
    // Подробный уровень детализации — только для Премиума.
    if (detail_level === 'detailed' && id !== 'premium') continue
    return id
  }
  const allowed = TIER_ORDER.filter((id) => tierAllowedForWorkType(id, work_type))
  return allowed[allowed.length - 1] || TIER_ORDER[TIER_ORDER.length - 1]
}

/**
 * Вернёт true, если тариф tierId справится с указанным объёмом.
 */
export function tierFits(tierId, { slides_count, duration_minutes, detail_level, work_type }, tiers = TIER_LIMITS) {
  const t = tiers[tierId]
  if (!t) return false
  if (!tierAllowedForWorkType(tierId, work_type)) return false
  if (slides_count && slides_count > t.max_slides) return false
  if (duration_minutes && duration_minutes > t.max_duration_minutes) return false
  if (detail_level === 'detailed' && tierId !== 'premium') return false
  return true
}
