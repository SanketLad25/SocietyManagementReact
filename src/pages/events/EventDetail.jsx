import { useState } from 'react'
import { getSession } from '../../api/session.js'
import { isNoticeManagerRole } from '../../config/roles.js'
import Modal from '../../components/Modal.jsx'
import EventForm from './EventForm.jsx'

export default function EventDetail({ event, onChanged }) {
  const session = getSession()
  const canManage = isNoticeManagerRole(session?.role)
  const [editing, setEditing] = useState(false)

  const handleSaved = () => {
    setEditing(false)
    onChanged()
  }

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
      {event.maxParticipants != null && <p className="field-hint">Limited to {event.maxParticipants} participants</p>}

      <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{event.description}</p>

      {canManage && (
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="table-secondary-btn" onClick={() => setEditing(true)}>
            Edit event
          </button>
        </div>
      )}

      {editing && (
        <Modal title="Edit Event" subtitle="Update this event's details." onClose={() => setEditing(false)}>
          <EventForm event={event} onClose={() => setEditing(false)} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
