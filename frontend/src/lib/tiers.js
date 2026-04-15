// Локальная копия лимитов тарифов — синхронизирована с backend/config.py.
// Для надёжного UX используем её, пока /payments/tiers ещё не загрузился;
// после загрузки API эти значения заменяются полученными.
export const TIER_ORDER = ['basic', 'standard', 'premium']

export const TIER_LIMITS = {
  basic:    { label: 'Базовый',  max_slides: 12, max_duration_minutes: 15, price_rub: 99 },
  standard: { label: 'Стандарт', max_slides: 20, max_duration_minutes: 25, price_rub: 199 },
  premium:  { label: 'Премиум',  max_slides: 30, max_duration_minutes: 45, price_rub: 399 },
}

/**
 * Возвращает id минимального тарифа, который поддерживает заданный объём.
 * Если передать оба ограничения — берётся более строгое.
 */
export function minTierFor({ slides_count, duration_minutes, detail_level }, tiers = TIER_LIMITS) {
  for (const id of TIER_ORDER) {
    const t = tiers[id]
    if (!t) continue
    if (slides_count && slides_count > t.max_slides) continue
    if (duration_minutes && duration_minutes > t.max_duration_minutes) continue
    // Подробный уровень детализации — только для Премиума.
    if (detail_level === 'detailed' && id !== 'premium') continue
    return id
  }
  return TIER_ORDER[TIER_ORDER.length - 1]
}

/**
 * Вернёт true, если тариф tierId справится с указанным объёмом.
 */
export function tierFits(tierId, { slides_count, duration_minutes, detail_level }, tiers = TIER_LIMITS) {
  const t = tiers[tierId]
  if (!t) return false
  if (slides_count && slides_count > t.max_slides) return false
  if (duration_minutes && duration_minutes > t.max_duration_minutes) return false
  if (detail_level === 'detailed' && tierId !== 'premium') return false
  return true
}
