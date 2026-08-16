import { apiGet, apiPost } from './client.js'

export function listAmenitySubscriptions(amenityId) {
  return apiGet(`/maintenance/amenities/${amenityId}/subscriptions`)
}

export function createAmenitySubscription(amenityId, payload) {
  return apiPost(`/maintenance/amenities/${amenityId}/subscriptions`, payload)
}

export function cancelAmenitySubscription(amenityId, subscriptionId, effectiveTo) {
  return apiPost(`/maintenance/amenities/${amenityId}/subscriptions/${subscriptionId}/cancel`, { effectiveTo })
}
