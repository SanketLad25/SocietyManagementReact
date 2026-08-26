import { apiGet, apiPut } from './client.js'

export function listMyVisitorNotifications() {
  return apiGet('/visitor-notifications/mine')
}

export function markVisitorNotificationRead(notificationId) {
  return apiPut(`/visitor-notifications/${notificationId}/read`)
}
