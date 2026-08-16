import { apiGet, apiPost } from './client.js'

export function listChargeRules(categoryId) {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
  return apiGet(`/maintenance/charge-rules${query}`)
}

export function createChargeRule(payload) {
  return apiPost('/maintenance/charge-rules', payload)
}

export function reviseChargeRule(ruleId, payload) {
  return apiPost(`/maintenance/charge-rules/${ruleId}/revise`, payload)
}

export function getMyCharges() {
  return apiGet('/maintenance/charge-rules/my-flat')
}
