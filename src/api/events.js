import { apiGet, apiPost, apiPut } from './client.js'

// Lets other UI (a future notification bell) react instantly to publish/edit actions in the same
// session — same pattern as complaints.js's complaints:changed event.
const EVENTS_CHANGED_EVENT = 'events:changed'

function notifyEventsChanged() {
  window.dispatchEvent(new Event(EVENTS_CHANGED_EVENT))
}

export function subscribeToEventsChanged(callback) {
  window.addEventListener(EVENTS_CHANGED_EVENT, callback)
  return () => window.removeEventListener(EVENTS_CHANGED_EVENT, callback)
}

export function listEvents({ categoryId, status } = {}) {
  const params = new URLSearchParams()
  if (categoryId) params.set('categoryId', categoryId)
  if (status) params.set('status', status)
  const query = params.toString()
  return apiGet(`/events${query ? `?${query}` : ''}`)
}

export function getEvent(eventId) {
  return apiGet(`/events/${eventId}`)
}

export function listEventRegistrations(eventId) {
  return apiGet(`/events/${eventId}/registrations`)
}

export async function createEvent(payload) {
  const result = await apiPost('/events', payload)
  notifyEventsChanged()
  return result
}

export async function updateEvent(eventId, payload) {
  const result = await apiPut(`/events/${eventId}`, payload)
  notifyEventsChanged()
  return result
}

export async function markInterested(eventId) {
  const result = await apiPost(`/events/${eventId}/interest`, {})
  notifyEventsChanged()
  return result
}

export async function joinEvent(eventId, payload) {
  const result = await apiPost(`/events/${eventId}/join`, payload)
  notifyEventsChanged()
  return result
}

export async function cancelMyRegistration(eventId) {
  const result = await apiPost(`/events/${eventId}/cancel-registration`, {})
  notifyEventsChanged()
  return result
}

export async function cancelEvent(eventId, reason) {
  const result = await apiPost(`/events/${eventId}/cancel`, { reason })
  notifyEventsChanged()
  return result
}

export async function promoteRegistration(eventId, registrationId) {
  const result = await apiPost(`/events/${eventId}/registrations/${registrationId}/promote`, {})
  notifyEventsChanged()
  return result
}
