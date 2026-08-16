import { clearSession, getSession } from './session.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5124/api'

function toFieldErrors(errors) {
  if (!errors) return undefined
  const fieldErrors = {}
  for (const [key, messages] of Object.entries(errors)) {
    fieldErrors[key.charAt(0).toLowerCase() + key.slice(1)] = Array.isArray(messages) ? messages[0] : messages
  }
  return fieldErrors
}

async function request(method, path, { body, auth = false } = {}) {
  let response
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (auth) {
      const session = getSession()
      if (session?.token) {
        headers.Authorization = `Bearer ${session.token}`
      }
    }

    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Unable to reach the server. Please check your connection and try again.')
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    if (auth && response.status === 401) {
      clearSession()
    }
    const message = data?.message || data?.title || 'Something went wrong. Please try again.'
    const error = new Error(message)
    error.fieldErrors = toFieldErrors(data?.errors)
    error.status = response.status
    throw error
  }

  return data
}

export function loginResident(payload) {
  return request('POST', '/auth/login', { body: payload })
}

export function changePassword(payload) {
  return request('POST', '/auth/change-password', { body: payload, auth: true })
}

export function apiGet(path) {
  return request('GET', path, { auth: true })
}

export function apiPost(path, body) {
  return request('POST', path, { body, auth: true })
}

export function apiPut(path, body) {
  return request('PUT', path, { body, auth: true })
}

export function apiDelete(path) {
  return request('DELETE', path, { auth: true })
}
