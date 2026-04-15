import client from './client.js'

export const authApi = {
  register: (email, password) =>
    client.post('/auth/register', { email, password }),
  login: (email, password) =>
    client.post('/auth/login', { email, password }),
  logout: () =>
    client.post('/auth/logout'),
  me: () =>
    client.get('/auth/me'),
  refresh: () =>
    client.post('/auth/refresh'),
}

export const ordersApi = {
  create: (data) =>
    client.post('/orders/', data),
  list: () =>
    client.get('/orders/'),
  get: (id) =>
    client.get(`/orders/${id}`),
  delete: (id) =>
    client.delete(`/orders/${id}`),
  updateTier: (id, tier) =>
    client.patch(`/orders/${id}/tier`, { tier }),
  updateNotes: (id, custom_elements) =>
    client.patch(`/orders/${id}/notes`, { custom_elements }),
}

export const paymentsApi = {
  getTiers: () =>
    client.get('/payments/tiers'),
  createSession: (order_id) =>
    client.post('/payments/create-session', { order_id }),
}

export const generationApi = {
  getStatus: (orderId) =>
    client.get(`/generation/status/${orderId}`),
  approveSpeech: (orderId) =>
    client.post(`/generation/${orderId}/speech/approve`),
  regenerateSpeech: (orderId, note) =>
    client.post(`/generation/${orderId}/speech/regenerate`, { note: note || null }),
  approveSlides: (orderId) =>
    client.post(`/generation/${orderId}/slides/approve`),
  regenerateSlides: (orderId, note) =>
    client.post(`/generation/${orderId}/slides/regenerate`, { note: note || null }),
}

export const filesApi = {
  upload: (orderId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/files/upload/${orderId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadUrl: (orderId) => `/files/download/${orderId}`,
  previewUrl: (orderId, index) => `/files/preview/${orderId}/${index}`,
}
