import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listResidents(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet(`/residents${query}`)
}

export function getResident(residentId) {
  return apiGet(`/residents/${residentId}`)
}

export function createResident(payload) {
  return apiPost('/residents', payload)
}

export function updateResident(residentId, payload) {
  return apiPut(`/residents/${residentId}`, payload)
}

export function deleteResident(residentId) {
  return apiDelete(`/residents/${residentId}`)
}
