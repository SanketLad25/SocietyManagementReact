import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listEventCategories() {
  return apiGet('/events/categories')
}

export function createEventCategory(payload) {
  return apiPost('/events/categories', payload)
}

export function updateEventCategory(categoryId, payload) {
  return apiPut(`/events/categories/${categoryId}`, payload)
}

export function deleteEventCategory(categoryId) {
  return apiDelete(`/events/categories/${categoryId}`)
}
