import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvent, listEvents, subscribeToEventsChanged } from '../../api/events.js'
import { listEventCategories } from '../../api/eventCategories.js'
import { getSession } from '../../api/session.js'
import { isNoticeManagerRole } from '../../config/roles.js'
import Modal from '../../components/Modal.jsx'
import EventForm from './EventForm.jsx'
import EventDetail from './EventDetail.jsx'
import '../../styles/dataTable.css'

function eventStatusBadge(event) {
  if (event.myRegistrationStatus === 'Registered') return { label: "You're in", cls: 'badge-success' }
  if (event.myRegistrationStatus === 'Waitlisted') return { label: 'Waitlisted', cls: 'badge-warning' }
  if (!event.registrationRequired) return null
  if (event.maxParticipants == null) return { label: 'Open', cls: 'badge-success' }
  if (event.registeredCount >= event.maxParticipants) return { label: 'Full', cls: 'badge-muted' }
  if (event.registeredCount / event.maxParticipants >= 0.8) return { label: 'Filling fast', cls: 'badge-warning' }
  return { label: 'Open', cls: 'badge-success' }
}

export default function EventList() {
  const session = getSession()
  const canManage = isNoticeManagerRole(session?.role)
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const load = async (categoryId) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listEvents({ categoryId: categoryId || undefined })
      setEvents(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    listEventCategories().then(setCategories).catch(() => {})
    load(categoryFilter)
    const unsubscribe = subscribeToEventsChanged(() => load(categoryFilter))
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterClick = (categoryId) => {
    setCategoryFilter(categoryId)
    load(categoryId)
  }

  const openAddModal = () => setAddModalOpen(true)
  const closeAddModal = () => setAddModalOpen(false)
  const handleCreated = () => {
    setAddModalOpen(false)
    load(categoryFilter)
  }

  const openDetail = (event) => setSelectedEvent(event)
  const closeDetail = () => {
    setSelectedEvent(null)
    load(categoryFilter)
  }
  const handleDetailChanged = async () => {
    const fresh = await getEvent(selectedEvent.eventId)
    setSelectedEvent(fresh)
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Events</h2>
          <p>Everything happening around your society.</p>
        </div>
        <div className="table-header-actions">
          {canManage && (
            <button type="button" className="table-secondary-btn" onClick={() => navigate('/dashboard/events/categories')}>
              Categories
            </button>
          )}
          {canManage && (
            <button type="button" className="table-primary-btn" onClick={openAddModal}>
              + Add Event
            </button>
          )}
        </div>
      </div>

      <div className="event-chip-row">
        <button
          type="button"
          className={`event-chip ${categoryFilter == null ? 'is-active' : ''}`}
          onClick={() => handleFilterClick(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.eventCategoryId}
            type="button"
            className={`event-chip ${categoryFilter === category.eventCategoryId ? 'is-active' : ''}`}
            onClick={() => handleFilterClick(category.eventCategoryId)}
          >
            {category.categoryName}
          </button>
        ))}
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="table-empty">No upcoming events yet. Stay connected — exciting society events will appear here soon.</p>
      ) : (
        <div className="event-grid">
          {events.map((event) => {
            const statusBadge = eventStatusBadge(event)
            return (
              <button type="button" key={event.eventId} className="event-card" onClick={() => openDetail(event)}>
                <div className="event-card__banner">{event.coverEmoji || '📅'}</div>
                <div className="event-card__body">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="table-badge badge-primary">{event.categoryName}</span>
                    {statusBadge && <span className={`table-badge ${statusBadge.cls}`}>{statusBadge.label}</span>}
                  </div>
                  <div className="event-card__title">{event.eventName}</div>
                  <div className="event-card__meta">{new Date(event.startOn).toLocaleString()}</div>
                  <div className="event-card__meta">{event.venue}</div>
                  <div className="event-card__meta">{event.organizerName}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {addModalOpen && (
        <Modal title="Add Event" subtitle="Publish a new event for your society." onClose={closeAddModal}>
          <EventForm onClose={closeAddModal} onSaved={handleCreated} />
        </Modal>
      )}

      {selectedEvent && (
        <Modal title={selectedEvent.eventName} subtitle={selectedEvent.categoryName} onClose={closeDetail}>
          <EventDetail event={selectedEvent} onChanged={handleDetailChanged} />
        </Modal>
      )}
    </div>
  )
}
