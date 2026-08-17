import { apiGet, apiPost } from './client.js'

export function listMyEventNotifications() {
  return apiGet('/events/notifications/mine')
}

export function markEventNotificationRead(notificationId) {
  return apiPost(`/events/notifications/${notificationId}/read`, {})
}
