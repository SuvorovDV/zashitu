import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокируем axios до импорта api/client.js
vi.mock('axios', () => {
  const mockInstance = {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
    __mockInstance: mockInstance,
  }
})

describe('API модули — экспортируемые функции', () => {
  it('authApi экспортирует нужные методы', async () => {
    const { authApi } = await import('../api/index.js')
    expect(typeof authApi.register).toBe('function')
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.logout).toBe('function')
    expect(typeof authApi.me).toBe('function')
    expect(typeof authApi.refresh).toBe('function')
  })

  it('ordersApi экспортирует нужные методы', async () => {
    const { ordersApi } = await import('../api/index.js')
    expect(typeof ordersApi.create).toBe('function')
    expect(typeof ordersApi.list).toBe('function')
    expect(typeof ordersApi.get).toBe('function')
    expect(typeof ordersApi.delete).toBe('function')
  })

  it('paymentsApi экспортирует нужные методы', async () => {
    const { paymentsApi } = await import('../api/index.js')
    expect(typeof paymentsApi.getTiers).toBe('function')
    expect(typeof paymentsApi.createSession).toBe('function')
  })

  it('generationApi экспортирует нужные методы', async () => {
    const { generationApi } = await import('../api/index.js')
    expect(typeof generationApi.getStatus).toBe('function')
  })

  it('filesApi экспортирует нужные методы', async () => {
    const { filesApi } = await import('../api/index.js')
    expect(typeof filesApi.upload).toBe('function')
    expect(typeof filesApi.downloadUrl).toBe('function')
  })
})

describe('filesApi — downloadUrl', () => {
  it('возвращает правильный путь', async () => {
    const { filesApi } = await import('../api/index.js')
    expect(filesApi.downloadUrl('order-123')).toBe('/files/download/order-123')
  })

  it('подставляет orderId в URL', async () => {
    const { filesApi } = await import('../api/index.js')
    const url = filesApi.downloadUrl('abc-def-ghi')
    expect(url).toContain('abc-def-ghi')
    expect(url.startsWith('/files/download/')).toBe(true)
  })
})
