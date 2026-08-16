const SESSION_KEY = 'shubhangi-chsl.auth'

export function saveSession(authResponse) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(authResponse))
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function isSessionValid(session) {
  return Boolean(session?.token) && new Date(session.expiresAtUtc).getTime() > Date.now()
}
