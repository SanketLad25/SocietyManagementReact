import { apiGet, apiPost, apiPut } from './client.js'

export function listBillingFrequencies() {
  return apiGet('/maintenance/billing-frequencies')
}

export function createBillingFrequency(payload) {
  return apiPost('/maintenance/billing-frequencies', payload)
}

export function updateBillingFrequency(billingFrequencyId, payload) {
  return apiPut(`/maintenance/billing-frequencies/${billingFrequencyId}`, payload)
}
