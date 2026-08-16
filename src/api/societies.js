import { apiGet, apiPost, apiPut } from './client.js'

export function listSocieties() {
  return apiGet('/societies')
}

export function getSociety(societyId) {
  return apiGet(`/societies/${societyId}`)
}

export function createSociety(payload) {
  return apiPost('/societies', payload)
}

export function updateSociety(societyId, payload) {
  return apiPut(`/societies/${societyId}`, payload)
}

export function createFirstAdmin(societyId, payload) {
  return apiPost(`/societies/${societyId}/admin`, payload)
}
