import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listVisitorCategories() {
  return apiGet('/visitors/categories')
}

export function createVisitorCategory(payload) {
  return apiPost('/visitors/categories', payload)
}

export function updateVisitorCategory(categoryId, payload) {
  return apiPut(`/visitors/categories/${categoryId}`, payload)
}

export function deleteVisitorCategory(categoryId) {
  return apiDelete(`/visitors/categories/${categoryId}`)
}
