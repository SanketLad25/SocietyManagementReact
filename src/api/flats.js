import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listFlats(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet(`/flats${query}`)
}

export function createFlat(payload) {
  return apiPost('/flats', payload)
}

export function updateFlat(flatId, payload) {
  return apiPut(`/flats/${flatId}`, payload)
}

export function deleteFlat(flatId) {
  return apiDelete(`/flats/${flatId}`)
}
