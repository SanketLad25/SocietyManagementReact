import { apiGet, apiPost, apiPut } from './client.js'

export function listMaintenanceCategories() {
  return apiGet('/maintenance/categories')
}

export function createMaintenanceCategory(payload) {
  return apiPost('/maintenance/categories', payload)
}

export function updateMaintenanceCategory(categoryId, payload) {
  return apiPut(`/maintenance/categories/${categoryId}`, payload)
}
