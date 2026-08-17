import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvent, listEvents, subscribeToEventsChanged } from '../api/events.js'
import { listMyEventNotifications, markEventNotificationRead } from '../api/eventNotifications.js'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import EventDetail from '../pages/events/EventDetail.jsx'
import '../styles/noticeBell.css'

const CALENDAR_ICON = [
  'M7 3v4',
  'M17 3v4',
  'M4 8h16',
  'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  'M9 13h2v2H9z',
]

const REFRESH_INTERVAL_MS = 60000

export default function EventBell() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [popupOpen, setPopupOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    listEvents()
      .then((data) => {
        const upcoming = data
          .filter((e) => e.status !== 'Cancelled' && new Date(e.startOn) >= new Date())
          .sort((a, b) => new Date(a.startOn) - new Date(b.startOn))
        setEvents(upcoming)
      })
      .catch(() => {})

    listMyEventNotifications()
      .then(setNotifications)
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const unsubscribe = subscribeToEventsChanged(load)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const sortedNotifications = [...notifications].sort((a, b) => Number(a.isRead) - Number(b.isRead))
  const badgeCount = unreadCount > 0 ? unreadCount : events.length

  const openPopup = () => {
    load()
    setSelectedEvent(null)
    setError('')
    setPopupOpen(true)
  }

  const closePopup = () => {
    setPopupOpen(false)
    setSelectedEvent(null)
  }

  const openEvent = async (eventId) => {
    setError('')
    try {
      const fresh = await getEvent(eventId)
      setSelectedEvent(fresh)
    } catch (err) {
      setError(err.message)
    }
  }

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      markEventNotificationRead(notification.eventNotificationId).then(load).catch(() => {})
    }
    await openEvent(notification.eventId)
  }

  const handleDetailChanged = async () => {
    if (!selectedEvent) return
    const fresh = await getEvent(selectedEvent.eventId)
    setSelectedEvent(fresh)
    load()
  }

  const goToAllEvents = () => {
    closePopup()
    navigate('/dashboard/events')
  }

  return (
    <>
      <button type="button" className="notice-bell" aria-label="Upcoming events" onClick={openPopup}>
        <Icon paths={CALENDAR_ICON} size={20} />
        {badgeCount > 0 && <span className="notice-bell-badge">{badgeCount > 9 ? '9+' : badgeCount}</span>}
      </button>

      {popupOpen && (
        <Modal
          title={selectedEvent ? selectedEvent.eventName : 'Events'}
          subtitle={selectedEvent ? undefined : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          onClose={closePopup}
        >
          {selectedEvent ? (
            <div>
              <button type="button" className="table-link-btn notice-bell-back" onClick={() => setSelectedEvent(null)}>
                ← Back to events
              </button>
              {error && <p className="auth-banner-error">{error}</p>}
              <EventDetail event={selectedEvent} onChanged={handleDetailChanged} />
            </div>
          ) : (
            <>
              {error && <p className="auth-banner-error">{error}</p>}

              {sortedNotifications.length > 0 && (
                <>
                  <p className="table-section-title" style={{ margin: '0 0 8px' }}>Notifications</p>
                  <ul className="notice-bell-list">
                    {sortedNotifications.slice(0, 8).map((notification) => (
                      <li key={notification.eventNotificationId} className={notification.isRead ? '' : 'unread'}>
                        <button type="button" onClick={() => openNotification(notification)}>
                          <span className="notice-bell-item-title">{notification.message}</span>
                          <span className="notice-bell-item-date">{new Date(notification.createdOn).toLocaleDateString()}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="table-section-title" style={{ margin: '0 0 8px' }}>Upcoming Events</p>
              {events.length === 0 ? (
                <p className="table-empty">No upcoming events yet.</p>
              ) : (
                <ul className="notice-bell-list">
                  {events.slice(0, 8).map((event) => (
                    <li key={event.eventId}>
                      <button type="button" onClick={() => openEvent(event.eventId)}>
                        <span className="notice-bell-item-title">
                          {event.coverEmoji ? `${event.coverEmoji} ` : ''}
                          {event.eventName}
                        </span>
                        <span className="notice-bell-item-date">{new Date(event.startOn).toLocaleDateString()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="form-actions">
                <button type="button" className="table-secondary-btn" onClick={goToAllEvents}>
                  View all events
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
