import { apiGet, apiPost } from './client.js'

export function listMyComplaintNotifications() {
  return apiGet('/complaints/notifications/mine')
}

export function markComplaintNotificationRead(notificationId) {
  return apiPost(`/complaints/notifications/${notificationId}/read`)
}
