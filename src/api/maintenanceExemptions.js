import { apiGet, apiPost, apiPut } from './client.js'

export function listExemptions(categoryId) {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
  return apiGet(`/maintenance/exemptions${query}`)
}

export function createExemption(payload) {
  return apiPost('/maintenance/exemptions', payload)
}

export function updateExemption(exemptionId, payload) {
  return apiPut(`/maintenance/exemptions/${exemptionId}`, payload)
}
