import { apiDelete, apiGet, apiPost, apiPut } from './client.js'
import { getSession } from './session.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5124/api'

// Lets VisitorBell react instantly to actions taken elsewhere in the same session (logging,
// approving/rejecting, check-in/out, cancel) instead of waiting for its next periodic poll — same
// pattern as complaints.js's complaints:changed event.
const VISITORS_CHANGED_EVENT = 'visitors:changed'

function notifyVisitorsChanged() {
  window.dispatchEvent(new Event(VISITORS_CHANGED_EVENT))
}

export function subscribeToVisitorsChanged(callback) {
  window.addEventListener(VISITORS_CHANGED_EVENT, callback)
  return () => window.removeEventListener(VISITORS_CHANGED_EVENT, callback)
}

export function listVisitors({ status, flatId, search } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (flatId) params.set('flatId', flatId)
  if (search) params.set('search', search)
  const query = params.toString()
  return apiGet(`/visitors${query ? `?${query}` : ''}`)
}

export function getVisitor(visitorLogId) {
  return apiGet(`/visitors/${visitorLogId}`)
}

export async function createVisitor(payload) {
  const result = await apiPost('/visitors', payload)
  notifyVisitorsChanged()
  return result
}

export async function approveVisitor(visitorLogId) {
  const result = await apiPut(`/visitors/${visitorLogId}/approve`)
  notifyVisitorsChanged()
  return result
}

export async function rejectVisitor(visitorLogId) {
  const result = await apiPut(`/visitors/${visitorLogId}/reject`)
  notifyVisitorsChanged()
  return result
}

export async function checkInVisitor(visitorLogId) {
  const result = await apiPut(`/visitors/${visitorLogId}/check-in`)
  notifyVisitorsChanged()
  return result
}

export async function checkOutVisitor(visitorLogId) {
  const result = await apiPut(`/visitors/${visitorLogId}/check-out`)
  notifyVisitorsChanged()
  return result
}

export async function deleteVisitor(visitorLogId) {
  const result = await apiDelete(`/visitors/${visitorLogId}`)
  notifyVisitorsChanged()
  return result
}

export async function uploadVisitorPhotos(visitorLogId, files) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/visitors/${visitorLogId}/attachments`, {
    method: 'POST',
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: formData,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || 'Failed to upload photo(s).')
  }
  notifyVisitorsChanged()
  return data
}

// Attachment downloads require the Bearer token, so a plain <img src="..."> can't hit this
// endpoint directly — callers fetch the blob themselves, either to open it full-size (below) or
// to build an object URL for an inline thumbnail (VisitorDetail.jsx's PhotoGallery).
export async function fetchVisitorAttachmentBlob(visitorLogId, attachment) {
  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/visitors/${visitorLogId}/attachments/${attachment.visitorAttachmentId}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
  })

  if (!response.ok) {
    throw new Error('Failed to load photo.')
  }

  return response.blob()
}

// Visitor photos are always images — open in a new tab for preview rather than downloading.
export async function openVisitorAttachment(visitorLogId, attachment) {
  const blob = await fetchVisitorAttachmentBlob(visitorLogId, attachment)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
