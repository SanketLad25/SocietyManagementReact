import { useEffect, useRef, useState } from 'react'
import { getSession } from '../api/session.js'
import { confirmAction, getSessionHistory, sendMessage } from '../api/chat.js'
import Icon from './Icon.jsx'
import '../styles/chatWidget.css'

const CHAT_ICON = [
  'M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-4-1L3 20l1.3-3.9a8.4 8.4 0 0 1-1.3-4.6A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z',
]
const CLOSE_ICON = ['M18 6 6 18', 'M6 6l12 12']
const SEND_ICON = ['M22 2 11 13', 'M22 2 15 22 11 13 2 9 22 2Z']

// SocChatBot.md Phase 5: "Raise a complaint" re-added now that raise_complaint actually ships,
// alongside the three Phase 4 chips (get_my_maintenance_dues, get_complaint_status, RAG).
const SUGGESTED_PROMPTS = [
  "What's my maintenance due?",
  'Check my complaint status',
  "What's the guest parking policy?",
  'Raise a complaint',
]

let idCounter = 0
function nextId() {
  idCounter += 1
  return idCounter
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bodyRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!open || historyLoaded) return
    setHistoryLoaded(true)
    getSessionHistory()
      .then((history) => {
        const rows = history?.messages || []
        const loaded = rows.map((row) => ({
          id: nextId(),
          role: row.role === 'assistant' ? 'assistant' : 'user',
          text: row.content,
          citations: row.citations || [],
          pending: false,
          pendingAction: null,
        }))

        // SocChatBot.md Phase 5: a still-open confirmation isn't a persisted ChatMessageRecord (the
        // turn paused before anything was saved), so it's appended here as a synthetic assistant
        // message rather than coming back as one of the rows above — reopening the widget shouldn't
        // lose the Confirm/Cancel UI.
        if (history?.pendingAction) {
          loaded.push({
            id: nextId(),
            role: 'assistant',
            text: '',
            citations: [],
            pending: false,
            pendingAction: { ...history.pendingAction, resolving: false },
          })
        }

        setMessages(loaded)
      })
      .catch(() => {
        // Non-fatal — an empty/failed history load just means the widget starts with the chip menu.
      })
  }, [open, historyLoaded])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Not rendered for a SuperAdmin session — DashboardLayout.jsx guards mounting this component at
  // all (same session?.role !== 'SuperAdmin' check the notice/complaint/event bells use), so
  // `session` here is always a real society-scoped account.
  const session = getSession()

  const appendAssistantDelta = (assistantId, delta) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + delta } : m)),
    )
  }

  const finalizeAssistant = (assistantId, finalText, citations) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, text: finalText, citations: citations || [], pending: false, pendingAction: null }
          : m,
      ),
    )
    setSending(false)
  }

  const failAssistant = (assistantId, errorMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, text: errorMessage, pending: false, pendingAction: null, error: true }
          : m,
      ),
    )
    setSending(false)
  }

  // SocChatBot.md Phase 5: a mutating tool_use (raise_complaint/join_event) paused instead of
  // auto-executing — render Confirm/Cancel in place of the typing indicator and wait for the
  // resident's explicit choice.
  const setPendingAction = (assistantId, token, toolName, summary) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, pending: false, pendingAction: { token, toolName, summary, resolving: false } }
          : m,
      ),
    )
    setSending(false)
  }

  const handleSend = (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return

    setInput('')
    setSending(true)

    const userId = nextId()
    const assistantId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text, citations: [] },
      { id: assistantId, role: 'assistant', text: '', citations: [], pending: true, pendingAction: null },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    sendMessage(text, {
      signal: controller.signal,
      onDelta: (delta) => appendAssistantDelta(assistantId, delta),
      onDone: (finalText, citations) => finalizeAssistant(assistantId, finalText, citations),
      onPendingAction: (token, toolName, summary) => setPendingAction(assistantId, token, toolName, summary),
      onError: (message) => failAssistant(assistantId, message),
    })
  }

  // Confirm/Cancel on a paused mutating tool call. Disables both buttons immediately (via the
  // `resolving` flag) so a slow round trip can't be double-clicked into a duplicate confirm request.
  const handleConfirmAction = (assistantId, token, approved) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId && m.pendingAction
          ? { ...m, pendingAction: { ...m.pendingAction, resolving: true } }
          : m,
      ),
    )
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    confirmAction(token, approved, {
      signal: controller.signal,
      onDelta: (delta) => appendAssistantDelta(assistantId, delta),
      onDone: (finalText, citations) => finalizeAssistant(assistantId, finalText, citations),
      onPendingAction: (nextToken, toolName, summary) => setPendingAction(assistantId, nextToken, toolName, summary),
      onError: (message) => failAssistant(assistantId, message),
    })
  }

  const handleChipClick = (prompt) => {
    setInput(prompt)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <button
        type="button"
        className="chat-fab"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon paths={open ? CLOSE_ICON : CHAT_ICON} size={24} />
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Society assistant chat">
          <div className="chat-panel-header">
            <div>
              <div className="chat-panel-header-title">Society Assistant</div>
              <div className="chat-panel-header-subtitle">{session?.societyName || 'Ask me anything'}</div>
            </div>
            <button type="button" className="chat-panel-close" aria-label="Close" onClick={() => setOpen(false)}>
              <Icon paths={CLOSE_ICON} size={16} />
            </button>
          </div>

          <div className="chat-panel-body" ref={bodyRef}>
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <p>Ask about notices, your maintenance dues, or a complaint's status.</p>
                <div className="chat-chips">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" className="chat-chip" onClick={() => handleChipClick(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id}>
                  {/* SocChatBot.md Phase 5: a freshly-paused turn has no text yet (nothing streamed
                      before the model called a mutating tool) — skip the empty bubble and go
                      straight to the confirmation card below, rather than showing a blank box above
                      it. */}
                  {!(m.pendingAction && m.text === '') && (
                    <div className={`chat-message ${m.role}${m.error ? ' error' : ''}`}>
                      {m.pending && m.text === '' ? (
                        <span className="chat-typing" aria-label="Assistant is typing">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        m.text
                      )}
                    </div>
                  )}
                  {m.role === 'assistant' && !m.pending && m.citations?.length > 0 && (
                    <div className="chat-citations">
                      <span className="chat-citations-label">Sources</span>
                      {m.citations.map((c) => (
                        <span key={`${c.sourceType}-${c.sourceId}`} className="chat-citation-pill">
                          {c.title}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.pendingAction && (
                    <div className="chat-pending-action">
                      <div className="chat-pending-summary">{m.pendingAction.summary}</div>
                      <div className="chat-pending-buttons">
                        <button
                          type="button"
                          className="chat-pending-confirm"
                          disabled={m.pendingAction.resolving}
                          onClick={() => handleConfirmAction(m.id, m.pendingAction.token, true)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="chat-pending-cancel"
                          disabled={m.pendingAction.resolving}
                          onClick={() => handleConfirmAction(m.id, m.pendingAction.token, false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="chat-panel-footer">
            <textarea
              className="chat-input"
              rows={1}
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              type="button"
              className="chat-send-btn"
              aria-label="Send"
              disabled={sending || !input.trim()}
              onClick={() => handleSend()}
            >
              <Icon paths={SEND_ICON} size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
