import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listComplaintCategories() {
  return apiGet('/complaints/categories')
}

export function createComplaintCategory(payload) {
  return apiPost('/complaints/categories', payload)
}

export function updateComplaintCategory(categoryId, payload) {
  return apiPut(`/complaints/categories/${categoryId}`, payload)
}

export function deleteComplaintCategory(categoryId) {
  return apiDelete(`/complaints/categories/${categoryId}`)
}
