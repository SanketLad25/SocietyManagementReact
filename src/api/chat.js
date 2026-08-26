import { apiGet } from './client.js'
import { clearSession, getSession } from './session.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5124/api'

// Restores the caller's single continuous ChatSession transcript (SocChatBot.md: no
// conversation-history sidebar in scope, just replaying the one ongoing session) so reopening the
// widget after navigating around the dashboard doesn't lose earlier turns. Resolves to
// `{ messages: [...], pendingAction: {token, toolName, summary} | null }` (Phase 5 widened this from
// a bare array so a still-open confirmation survives a panel close/reopen too).
export function getSessionHistory() {
  return apiGet('/chat/history')
}

/**
 * Streams one chat turn. Deliberately fetch + ReadableStream, not EventSource — EventSource cannot
 * set custom headers, so it can't carry `Authorization: Bearer <jwt>` (the only alternative would be
 * a token query-string parameter, which leaks into logs/history, exactly what this app's
 * header-based auth elsewhere avoids). Parses the backend's small SSE envelope
 * (`event: delta|pending_action|done|error\ndata: {...}\n\n`) by hand.
 *
 * @param {string} message
 * @param {{onDelta?: (text: string) => void, onDone?: (finalText: string, citations: Array) => void, onPendingAction?: (token: string, toolName: string, summary: string) => void, onError?: (message: string) => void, signal?: AbortSignal}} handlers
 */
export async function sendMessage(message, handlers = {}) {
  await streamSse(`${API_BASE_URL}/chat/message`, { message }, handlers)
}

/**
 * SocChatBot.md Phase 5: approves or declines a paused mutating tool_use (raise_complaint/
 * join_event). Same SSE envelope shape as sendMessage — on approve the real tool runs and its result
 * resumes the loop; on decline the model is told the user declined and responds gracefully. Either
 * way the response can itself carry a further "pending_action" event (e.g. the model proposes a
 * second confirmation-gated action right after this one resolves), handled identically to a normal
 * turn.
 *
 * @param {string} token
 * @param {boolean} approved
 * @param {{onDelta?: (text: string) => void, onDone?: (finalText: string, citations: Array) => void, onPendingAction?: (token: string, toolName: string, summary: string) => void, onError?: (message: string) => void, signal?: AbortSignal}} handlers
 */
export async function confirmAction(token, approved, handlers = {}) {
  await streamSse(`${API_BASE_URL}/chat/confirm`, { token, approved }, handlers)
}

async function streamSse(url, body, { onDelta, onDone, onPendingAction, onError, signal } = {}) {
  const session = getSession()
  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch {
    onError?.('Unable to reach the assistant. Please check your connection and try again.')
    return
  }

  if (response.status === 401) {
    clearSession()
    onError?.('Your session has expired. Please log in again.')
    return
  }

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null)
    onError?.(data?.message || 'The assistant could not be reached right now.')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    let chunk
    try {
      chunk = await reader.read()
    } catch {
      onError?.('The connection to the assistant was interrupted.')
      return
    }

    if (chunk.done) {
      return
    }

    buffer += decoder.decode(chunk.value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      handleSseEvent(buffer.slice(0, boundary), { onDelta, onDone, onPendingAction, onError })
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
  }
}

function handleSseEvent(rawEvent, { onDelta, onDone, onPendingAction, onError }) {
  let eventName = 'message'
  let data = ''
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      data += line.slice('data:'.length).trim()
    }
  }

  if (!data) return
  const payload = JSON.parse(data)

  if (eventName === 'delta') {
    onDelta?.(payload.text || '')
  } else if (eventName === 'pending_action') {
    onPendingAction?.(payload.token, payload.toolName, payload.summary)
  } else if (eventName === 'done') {
    onDone?.(payload.text || '', payload.citations || [])
  } else if (eventName === 'error') {
    onError?.(payload.message || 'The assistant hit an unexpected error.')
  }
}
