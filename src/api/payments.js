import { apiGet, apiPost } from './client.js'

export function recordPayment(payload) {
  return apiPost('/maintenance/payments', payload)
}

export function listPaymentsForBill(billId) {
  return apiGet(`/maintenance/payments?billId=${encodeURIComponent(billId)}`)
}

export function getPayment(paymentId) {
  return apiGet(`/maintenance/payments/${paymentId}`)
}

export function cancelPayment(paymentId, reason) {
  return apiPost(`/maintenance/payments/${paymentId}/cancel`, { reason })
}
