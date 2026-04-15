import { describe, it, expect } from 'vitest'
import { isUuid } from '../lib/uuid.js'

describe('isUuid', () => {
  it('валидирует v4 UUID', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })
  it('валидирует nil UUID', () => {
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true)
  })
  it('отклоняет пустую строку', () => {
    expect(isUuid('')).toBe(false)
  })
  it('отклоняет мусор', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('12345')).toBe(false)
  })
  it('отклоняет null/undefined', () => {
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
  it('отклоняет UUID с плохой версией', () => {
    // Третья группа должна начинаться с 1-5; 8 — не валидно.
    expect(isUuid('550e8400-e29b-81d4-a716-446655440000')).toBe(false)
  })
})
