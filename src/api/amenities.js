import { apiGet, apiPost, apiPut } from './client.js'

export function listAmenities() {
  return apiGet('/maintenance/amenities')
}

export function createAmenity(payload) {
  return apiPost('/maintenance/amenities', payload)
}

export function updateAmenity(amenityId, payload) {
  return apiPut(`/maintenance/amenities/${amenityId}`, payload)
}
