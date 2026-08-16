import { apiGet, apiPost } from './client.js'
import { getSession } from './session.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5124/api'

// Lets ComplaintSiren react instantly to actions taken elsewhere in the same session (creating,
// assigning, updating status/comments, confirming resolution) instead of waiting for its next
// periodic poll — same pattern as notices.js's notices:changed event.
const COMPLAINTS_CHANGED_EVENT = 'complaints:changed'

function notifyComplaintsChanged() {
  window.dispatchEvent(new Event(COMPLAINTS_CHANGED_EVENT))
}

export function subscribeToComplaintsChanged(callback) {
  window.addEventListener(COMPLAINTS_CHANGED_EVENT, callback)
  return () => window.removeEventListener(COMPLAINTS_CHANGED_EVENT, callback)
}

export function listComplaints({ status, categoryId, priority, search } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (categoryId) params.set('categoryId', categoryId)
  if (priority) params.set('priority', priority)
  if (search) params.set('search', search)
  const query = params.toString()
  return apiGet(`/complaints${query ? `?${query}` : ''}`)
}

export function getComplaint(complaintId) {
  return apiGet(`/complaints/${complaintId}`)
}

export function getComplaintStats() {
  return apiGet('/complaints/stats')
}

export async function createComplaint(payload) {
  const result = await apiPost('/complaints', payload)
  notifyComplaintsChanged()
  return result
}

export async function assignComplaint(complaintId, payload) {
  const result = await apiPost(`/complaints/${complaintId}/assign`, payload)
  notifyComplaintsChanged()
  return result
}

export async function updateComplaintStatus(complaintId, newStatus, comment) {
  const result = await apiPost(`/complaints/${complaintId}/status`, { newStatus, comment: comment || undefined })
  notifyComplaintsChanged()
  return result
}

export async function addComplaintComment(complaintId, commentText) {
  const result = await apiPost(`/complaints/${complaintId}/comments`, { commentText })
  notifyComplaintsChanged()
  return result
}

export async function confirmResolution(complaintId) {
  const result = await apiPost(`/complaints/${complaintId}/confirm-resolution`)
  notifyComplaintsChanged()
  return result
}

export async function uploadComplaintAttachments(complaintId, files, kind) {
  const formData = new FormData()
  formData.append('kind', kind)
  for (const file of files) {
    formData.append('files', file)
  }

  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/attachments`, {
    method: 'POST',
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: formData,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || 'Failed to upload photo(s).')
  }
  return data
}

// Complaint photos are always images — open in a new tab for preview rather than downloading.
export async function openComplaintAttachment(complaintId, attachment) {
  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/attachments/${attachment.complaintAttachmentId}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
  })

  if (!response.ok) {
    throw new Error('Failed to open photo.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
