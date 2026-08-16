import { apiGet, apiPost } from './client.js'

export function listBillingCycles() {
  return apiGet('/maintenance/billing-cycles')
}

export function createBillingCycle(payload) {
  return apiPost('/maintenance/billing-cycles', payload)
}

export function previewBillingCycle(cycleId, flatId) {
  return apiGet(`/maintenance/billing-cycles/${cycleId}/preview?flatId=${encodeURIComponent(flatId)}`)
}

export function generateBillingCycle(cycleId) {
  return apiPost(`/maintenance/billing-cycles/${cycleId}/generate`)
}

export function publishBillingCycle(cycleId) {
  return apiPost(`/maintenance/billing-cycles/${cycleId}/publish`)
}
