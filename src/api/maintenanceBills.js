import { apiGet } from './client.js'

export function listBills(flatId) {
  const query = flatId ? `?flatId=${encodeURIComponent(flatId)}` : ''
  return apiGet(`/maintenance/bills${query}`)
}

export function getBill(billId) {
  return apiGet(`/maintenance/bills/${billId}`)
}
