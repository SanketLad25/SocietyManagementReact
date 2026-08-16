import { apiGet, apiPost, apiPut } from './client.js'

export function listUsers() {
  return apiGet('/admin/users')
}

export function createUser(payload) {
  return apiPost('/admin/users', payload)
}

export function updateUser(userId, payload) {
  return apiPut(`/admin/users/${userId}`, payload)
}

export function resetUserPassword(userId, newPassword) {
  return apiPost(`/admin/users/${userId}/reset-password`, { newPassword })
}
