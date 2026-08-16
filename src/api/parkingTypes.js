import { apiGet, apiPost, apiPut } from './client.js'

export function listParkingTypes() {
  return apiGet('/maintenance/parking-types')
}

export function createParkingType(payload) {
  return apiPost('/maintenance/parking-types', payload)
}

export function updateParkingType(parkingTypeId, payload) {
  return apiPut(`/maintenance/parking-types/${parkingTypeId}`, payload)
}
