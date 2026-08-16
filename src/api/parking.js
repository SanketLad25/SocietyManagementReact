import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listParking(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet(`/parking${query}`)
}

export function createParking(payload) {
  return apiPost('/parking', payload)
}

export function updateParking(parkingId, payload) {
  return apiPut(`/parking/${parkingId}`, payload)
}

export function deleteParking(parkingId) {
  return apiDelete(`/parking/${parkingId}`)
}
