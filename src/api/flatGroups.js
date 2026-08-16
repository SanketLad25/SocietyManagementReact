import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export function listFlatGroups() {
  return apiGet('/maintenance/flat-groups')
}

export function createFlatGroup(payload) {
  return apiPost('/maintenance/flat-groups', payload)
}

export function updateFlatGroup(flatGroupId, payload) {
  return apiPut(`/maintenance/flat-groups/${flatGroupId}`, payload)
}

export function addFlatGroupMember(flatGroupId, flatId) {
  return apiPost(`/maintenance/flat-groups/${flatGroupId}/members`, { flatId })
}

export function removeFlatGroupMember(flatGroupId, flatId) {
  return apiDelete(`/maintenance/flat-groups/${flatGroupId}/members/${flatId}`)
}
