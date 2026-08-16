import { apiDelete, apiGet, apiPost, apiPut } from './client.js'
import { getSession } from './session.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5124/api'

// Lets NoticeBell's unread count react instantly to actions taken elsewhere in the same session
// (marking read on the Notices page, publishing/deleting a notice) instead of waiting for its
// next periodic poll. Cross-session/cross-user updates still rely on that poll — there's no
// push/websocket infrastructure in this app, matching the "no scheduler" simplification elsewhere.
const NOTICES_CHANGED_EVENT = 'notices:changed'

function notifyNoticesChanged() {
  window.dispatchEvent(new Event(NOTICES_CHANGED_EVENT))
}

export function subscribeToNoticesChanged(callback) {
  window.addEventListener(NOTICES_CHANGED_EVENT, callback)
  return () => window.removeEventListener(NOTICES_CHANGED_EVENT, callback)
}

export function listNotices({ categoryId, priority, search, sortBy, includeDrafts } = {}) {
  const params = new URLSearchParams()
  if (categoryId) params.set('categoryId', categoryId)
  if (priority) params.set('priority', priority)
  if (search) params.set('search', search)
  if (sortBy) params.set('sortBy', sortBy)
  if (includeDrafts) params.set('includeDrafts', 'true')
  const query = params.toString()
  return apiGet(`/notices${query ? `?${query}` : ''}`)
}

export function getNotice(noticeId) {
  return apiGet(`/notices/${noticeId}`)
}

export function createNotice(payload) {
  return apiPost('/notices', payload)
}

export function updateNotice(noticeId, payload) {
  return apiPut(`/notices/${noticeId}`, payload)
}

export async function publishNotice(noticeId) {
  const result = await apiPost(`/notices/${noticeId}/publish`)
  notifyNoticesChanged()
  return result
}

export async function deleteNotice(noticeId) {
  const result = await apiDelete(`/notices/${noticeId}`)
  notifyNoticesChanged()
  return result
}

export async function markNoticeRead(noticeId) {
  const result = await apiPost(`/notices/${noticeId}/read`)
  notifyNoticesChanged()
  return result
}

export async function uploadNoticeAttachments(noticeId, files) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/notices/${noticeId}/attachments`, {
    method: 'POST',
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: formData,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || 'Failed to upload attachment(s).')
  }
  return data
}

export function deleteNoticeAttachment(noticeId, attachmentId) {
  return apiDelete(`/notices/${noticeId}/attachments/${attachmentId}`)
}

// Images/PDFs open in a new tab for preview; other types (DOC/XLS) trigger a real download —
// matches the backend's Content-Disposition choice (inline vs attachment) for the same file.
export async function openNoticeAttachment(noticeId, attachment) {
  const session = getSession()
  const response = await fetch(`${API_BASE_URL}/notices/${noticeId}/attachments/${attachment.noticeAttachmentId}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
  })

  if (!response.ok) {
    throw new Error('Failed to open attachment.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const isPreviewable = attachment.contentType.startsWith('image/') || attachment.contentType === 'application/pdf'

  if (isPreviewable) {
    window.open(url, '_blank')
  } else {
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
