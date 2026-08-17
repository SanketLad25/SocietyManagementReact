import { useEffect, useState } from 'react'
import { getSession } from '../../api/session.js'
import { isNoticeManagerRole } from '../../config/roles.js'
import { cancelEvent, cancelMyRegistration, joinEvent, listEventRegistrations, markInterested, promoteRegistration } from '../../api/events.js'
import Modal from '../../components/Modal.jsx'
import EventForm from './EventForm.jsx'

const STATUS_LABEL = {
  Interested: 'Interested',
  Registered: "You're in",
  Waitlisted: "You're waitlisted",
  CancelledByResident: 'Cancelled',
  CancelledByOrganizer: 'Cancelled by organizer',
}

const STATUS_BADGE = {
  Interested: 'badge-neutral',
  Registered: 'badge-success',
  Waitlisted: 'badge-warning',
  CancelledByResident: 'badge-muted',
  CancelledByOrganizer: 'badge-muted',
}

function RegistrationPanel({ event, onChanged }) {
  const [joining, setJoining] = useState(false)
  const [participantCount, setParticipantCount] = useState('1')
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const myStatus = event.myRegistrationStatus
  const isActive = myStatus === 'Registered' || myStatus === 'Waitlisted'
  const isCancelled = myStatus === 'CancelledByResident' || myStatus === 'CancelledByOrganizer'

  const handleInterested = async () => {
    setStatus('interested')
    setError('')
    try {
      await markInterested(event.eventId)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    setStatus('joining')
    setError('')
    try {
      await joinEvent(event.eventId, {
        participantCount: Number(participantCount) || 1,
        comments: comments.trim() || null,
      })
      setJoining(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel your registration for this event?')) return
    setStatus('cancelling')
    setError('')
    try {
      await cancelMyRegistration(event.eventId)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="form-card" style={{ marginTop: 16 }}>
      {error && <p className="auth-banner-error">{error}</p>}

      {myStatus && (
        <p style={{ marginBottom: 12 }}>
          <span className={`table-badge ${STATUS_BADGE[myStatus] || 'badge-neutral'}`}>{STATUS_LABEL[myStatus] || myStatus}</span>
          {event.myRegistrationCode && isActive && <span className="field-hint" style={{ marginLeft: 8 }}>{event.myRegistrationCode}</span>}
        </p>
      )}

      {isActive ? (
        <button type="button" className="table-link-btn danger" disabled={status !== 'idle'} onClick={handleCancel}>
          {status === 'cancelling' ? 'Cancelling…' : 'Cancel my registration'}
        </button>
      ) : joining ? (
        <form onSubmit={handleJoinSubmit}>
          <div className="field">
            <label htmlFor="participantCount">Number of participants</label>
            <div className="field-control">
              <input
                id="participantCount"
                type="number"
                min="1"
                max="100"
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="comments">Comments (optional)</label>
            <div className="field-control">
              <textarea id="comments" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="table-secondary-btn" onClick={() => setJoining(false)}>
              Cancel
            </button>
            <button type="submit" className="auth-submit" disabled={status !== 'idle'}>
              {status === 'joining' ? 'Joining…' : 'Confirm registration'}
            </button>
          </div>
        </form>
      ) : (
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="table-secondary-btn" disabled={status !== 'idle' || myStatus === 'Interested'} onClick={handleInterested}>
            {myStatus === 'Interested' ? 'Interested ✓' : status === 'interested' ? 'Saving…' : 'Interested'}
          </button>
          <button type="button" className="table-primary-btn" onClick={() => setJoining(true)}>
            Join Event
          </button>
        </div>
      )}
      {isCancelled && <p className="field-hint" style={{ marginTop: 8 }}>You can join again any time before the event.</p>}
    </div>
  )
}

function RosterSection({ title, rows, emptyHint, onPromote, promotingId }) {
  if (rows.length === 0) {
    return (
      <div style={{ marginTop: 12 }}>
        <p className="table-section-title" style={{ margin: '0 0 4px' }}>{title} (0)</p>
        <p className="field-hint">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="table-section-title" style={{ margin: '0 0 4px' }}>{title} ({rows.length})</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <li key={r.eventRegistrationId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="field-hint" style={{ flex: 1 }}>
              {r.residentName}{r.flatNo ? ` — Flat ${r.flatNo}` : ''} · {r.participantCount} participant{r.participantCount === 1 ? '' : 's'}
              {r.comments ? ` · "${r.comments}"` : ''}
            </span>
            {onPromote && (
              <button
                type="button"
                className="table-link-btn"
                disabled={promotingId === r.eventRegistrationId}
                onClick={() => onPromote(r.eventRegistrationId)}
              >
                {promotingId === r.eventRegistrationId ? 'Promoting…' : 'Promote'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ManagerRoster({ eventId, onChanged }) {
  const [registrations, setRegistrations] = useState(null)
  const [error, setError] = useState('')
  const [promotingId, setPromotingId] = useState(null)

  const load = () => {
    listEventRegistrations(eventId)
      .then(setRegistrations)
      .catch((err) => setError(err.message))
  }

  useEffect(load, [eventId])

  const handlePromote = async (registrationId) => {
    setPromotingId(registrationId)
    setError('')
    try {
      await promoteRegistration(eventId, registrationId)
      load()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setPromotingId(null)
    }
  }

  if (error) return <p className="auth-banner-error" style={{ marginTop: 12 }}>{error}</p>
  if (registrations === null) return <p className="field-hint" style={{ marginTop: 12 }}>Loading registrations…</p>

  const registered = registrations.filter((r) => r.status === 'Registered')
  const waitlisted = registrations.filter((r) => r.status === 'Waitlisted')

  return (
    <div className="form-card" style={{ marginTop: 16 }}>
      <RosterSection title="Registered" rows={registered} emptyHint="No one has registered yet." />
      <RosterSection
        title="Waitlisted"
        rows={waitlisted}
        emptyHint="No one is waitlisted."
        onPromote={handlePromote}
        promotingId={promotingId}
      />
    </div>
  )
}

function CancelEventPanel({ event, onChanged }) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const activeCount = event.registeredCount + event.waitlistedCount

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('A reason is required.')
      return
    }
    setStatus('cancelling')
    setError('')
    try {
      await cancelEvent(event.eventId, reason.trim())
      onChanged()
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="form-card" style={{ marginTop: 16, borderColor: 'var(--error)' }}>
      {error && <p className="auth-banner-error">{error}</p>}
      <p className="table-section-title" style={{ margin: '0 0 4px', color: 'var(--error)' }}>Cancel event</p>
      {cancelling ? (
        <form onSubmit={handleSubmit}>
          <p className="field-hint" style={{ marginBottom: 10 }}>
            {activeCount > 0
              ? `This notifies ${event.registeredCount} registered and ${event.waitlistedCount} waitlisted resident(s) immediately.`
              : 'No one is registered yet, but this cannot be undone.'}
          </p>
          <div className="field">
            <label htmlFor="cancelReason">Reason</label>
            <div className="field-control">
              <textarea id="cancelReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="table-secondary-btn" onClick={() => setCancelling(false)}>
              Back
            </button>
            <button type="submit" className="table-link-btn danger" disabled={status !== 'idle'}>
              {status === 'cancelling' ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="table-link-btn danger" onClick={() => setCancelling(true)}>
          Cancel this event
        </button>
      )}
    </div>
  )
}

export default function EventDetail({ event, onChanged }) {
  const session = getSession()
  const canManage = isNoticeManagerRole(session?.role)
  const isResident = session?.role === 'Resident'
  const [editing, setEditing] = useState(false)

  const handleSaved = () => {
    setEditing(false)
    onChanged()
  }

  const seatsLeft = event.maxParticipants != null ? event.maxParticipants - event.registeredCount : null

  return (
    <div>
      <div className="detail-badges">
        <span className="table-badge badge-primary">{event.categoryName}</span>
        {event.status === 'Cancelled' && <span className="table-badge badge-muted">Cancelled</span>}
        {event.registrationRequired && <span className="table-badge badge-success">Registration required</span>}
      </div>

      <p style={{ fontSize: 32, marginTop: 4 }}>{event.coverEmoji || '📅'}</p>

      <p className="field-hint">
        {new Date(event.startOn).toLocaleString()}
        {event.endOn && <> – {new Date(event.endOn).toLocaleString()}</>}
        {' · '}
        {event.venue}
      </p>
      <p className="field-hint">Organized by {event.organizerName}</p>
      {event.maxParticipants != null && (
        <p className="field-hint">
          {event.registeredCount} / {event.maxParticipants} registered
          {seatsLeft != null && seatsLeft <= 0 && event.waitlistedCount > 0 && <> · {event.waitlistedCount} waitlisted</>}
        </p>
      )}

      <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{event.description}</p>

      {event.status === 'Cancelled' && (
        <div className="form-card" style={{ marginTop: 16, borderColor: 'var(--error)' }}>
          <p className="table-section-title" style={{ margin: '0 0 4px', color: 'var(--error)' }}>Cancelled</p>
          <p className="field-hint">{event.cancelReason}</p>
        </div>
      )}

      {isResident && event.registrationRequired && event.status !== 'Cancelled' && (
        <RegistrationPanel event={event} onChanged={onChanged} />
      )}

      {canManage && event.registrationRequired && <ManagerRoster eventId={event.eventId} onChanged={onChanged} />}

      {canManage && event.status !== 'Cancelled' && (
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="table-secondary-btn" onClick={() => setEditing(true)}>
            Edit event
          </button>
        </div>
      )}

      {canManage && event.status !== 'Cancelled' && <CancelEventPanel event={event} onChanged={onChanged} />}

      {editing && (
        <Modal title="Edit Event" subtitle="Update this event's details." onClose={() => setEditing(false)}>
          <EventForm event={event} onClose={() => setEditing(false)} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
