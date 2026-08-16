import { apiGet, apiPost, apiPut } from './client.js'

export function listNoticeCategories() {
  return apiGet('/notices/categories')
}

export function createNoticeCategory(payload) {
  return apiPost('/notices/categories', payload)
}

export function updateNoticeCategory(categoryId, payload) {
  return apiPut(`/notices/categories/${categoryId}`, payload)
}
