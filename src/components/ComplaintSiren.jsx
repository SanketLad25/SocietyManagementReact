import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getComplaint, subscribeToComplaintsChanged } from '../api/complaints.js'
import { listMyComplaintNotifications, markComplaintNotificationRead } from '../api/complaintNotifications.js'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import ComplaintDetail from '../pages/complaints/ComplaintDetail.jsx'
import '../styles/noticeBell.css'

// Hand-rolled siren/beacon icon (dome + three light-rays over a base) — deliberately distinct from
// NoticeBell's bell icon, per user decision (complaints.md §10/§11 item 3).
const SIREN_ICON = [
  'M7 21v-3a5 5 0 0 1 10 0v3',
  'M4 21h16',
  'M12 3v2',
  'M6.5 5.5l1.4 1.4',
  'M17.5 5.5l-1.4 1.4',
]

const REFRESH_INTERVAL_MS = 60000

export default function ComplaintSiren() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [popupOpen, setPopupOpen] = useState(false)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    listMyComplaintNotifications()
      .then(setNotifications)
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const unsubscribe = subscribeToComplaintsChanged(load)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const sortedNotifications = [...notifications].sort((a, b) => Number(a.isRead) - Number(b.isRead))

  const openPopup = () => {
    load()
    setSelectedComplaint(null)
    setError('')
    setPopupOpen(true)
  }

  const closePopup = () => {
    setPopupOpen(false)
    setSelectedComplaint(null)
  }

  const openNotification = async (notification) => {
    setError('')
    if (!notification.isRead) {
      markComplaintNotificationRead(notification.complaintNotificationId).then(load).catch(() => {})
    }
    try {
      const complaint = await getComplaint(notification.complaintId)
      setSelectedComplaint(complaint)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDetailChanged = async () => {
    if (!selectedComplaint) return
    const fresh = await getComplaint(selectedComplaint.complaintId)
    setSelectedComplaint(fresh)
  }

  const goToAllComplaints = () => {
    closePopup()
    navigate('/dashboard/complaints')
  }

  return (
    <>
      <button type="button" className="notice-bell" aria-label="Complaint notifications" onClick={openPopup}>
        <Icon paths={SIREN_ICON} size={20} />
        {unreadCount > 0 && <span className="notice-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {popupOpen && (
        <Modal
          title={selectedComplaint ? `Complaint #${selectedComplaint.complaintId}` : 'Complaint Notifications'}
          subtitle={selectedComplaint ? undefined : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          onClose={closePopup}
        >
          {selectedComplaint ? (
            <div>
              <button type="button" className="table-link-btn notice-bell-back" onClick={() => setSelectedComplaint(null)}>
                ← Back to notifications
              </button>
              {error && <p className="auth-banner-error">{error}</p>}
              <ComplaintDetail complaint={selectedComplaint} onChanged={handleDetailChanged} />
            </div>
          ) : sortedNotifications.length === 0 ? (
            <p className="table-empty">No complaint notifications yet.</p>
          ) : (
            <>
              {error && <p className="auth-banner-error">{error}</p>}
              <ul className="notice-bell-list">
                {sortedNotifications.slice(0, 8).map((notification) => (
                  <li key={notification.complaintNotificationId} className={notification.isRead ? '' : 'unread'}>
                    <button type="button" onClick={() => openNotification(notification)}>
                      <span className="notice-bell-item-title">{notification.message}</span>
                      <span className="notice-bell-item-date">{new Date(notification.createdOn).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="form-actions">
                <button type="button" className="table-secondary-btn" onClick={goToAllComplaints}>
                  View all complaints
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
