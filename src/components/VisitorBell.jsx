import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { approveVisitor, fetchVisitorAttachmentBlob, getVisitor, rejectVisitor, subscribeToVisitorsChanged } from '../api/visitors.js'
import { listMyVisitorNotifications, markVisitorNotificationRead } from '../api/visitorNotifications.js'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import VisitorDetail from '../pages/visitors/VisitorDetail.jsx'
import '../styles/noticeBell.css'

// Same "visitor" glyph used in the sidebar nav (dashboardNav.js) — a person with a check mark,
// deliberately distinct from NoticeBell's bell / ComplaintSiren's dome-and-rays / EventBell's
// calendar so the four icons stay visually distinguishable at a glance.
const VISITOR_ICON = [
  'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  'M8 13.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'M14 10.5l1.3 1.3L18 9',
  'M5.5 17c.4-1.5 1.6-2.5 3-2.5h1c1.4 0 2.6 1 3 2.5',
]

const PERSON_ICON_PATHS = ['M8 20a4 4 0 0 1 8 0', 'M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z']
const TICK_ICON_PATHS = ['M5 12.5l4.5 4.5L19 7']
const CROSS_ICON_PATHS = ['M6 6l12 12', 'M18 6L6 18']

const REFRESH_INTERVAL_MS = 60000

// A small circular avatar of the visitor's photo (if one was attached at log-in time), shown
// beside each notification — VisitorBell-only, since Notice/Complaint/Event notifications have no
// photo concept. Placeholder person icon when there's no attachment or it hasn't loaded yet.
function NotificationAvatar({ visitorLogId, attachment }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!attachment) return undefined
    let cancelled = false
    let objectUrl = ''

    fetchVisitorAttachmentBlob(visitorLogId, attachment)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [visitorLogId, attachment])

  return url ? (
    <img className="notice-bell-avatar" src={url} alt="" />
  ) : (
    <span className="notice-bell-avatar notice-bell-avatar-placeholder" aria-hidden="true">
      <Icon paths={PERSON_ICON_PATHS} size={18} />
    </span>
  )
}

export default function VisitorBell() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  // visitorLogId -> full VisitorLogResponse (fetched lazily so inline Approve/Reject buttons can
  // read the backend's Can* flags without re-deriving the authorization matrix in JS).
  const [logsByVisitorLogId, setLogsByVisitorLogId] = useState({})
  const [popupOpen, setPopupOpen] = useState(false)
  const [selectedVisitorLog, setSelectedVisitorLog] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    let list = []
    try {
      list = await listMyVisitorNotifications()
      setNotifications(list)
    } catch {
      return
    }

    const visible = [...list].sort((a, b) => Number(a.isRead) - Number(b.isRead)).slice(0, 8)
    const entries = await Promise.all(
      visible.map(async (n) => {
        try {
          return [n.visitorLogId, await getVisitor(n.visitorLogId)]
        } catch {
          return [n.visitorLogId, null]
        }
      }),
    )
    setLogsByVisitorLogId(Object.fromEntries(entries.filter(([, log]) => log !== null)))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const unsubscribe = subscribeToVisitorsChanged(load)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const sortedNotifications = [...notifications].sort((a, b) => Number(a.isRead) - Number(b.isRead))

  const openPopup = () => {
    load()
    setSelectedVisitorLog(null)
    setError('')
    setPopupOpen(true)
  }

  const closePopup = () => {
    setPopupOpen(false)
    setSelectedVisitorLog(null)
  }

  const openNotification = async (notification) => {
    setError('')
    if (!notification.isRead) {
      markVisitorNotificationRead(notification.visitorNotificationId).then(load).catch(() => {})
    }
    try {
      const log = logsByVisitorLogId[notification.visitorLogId] || (await getVisitor(notification.visitorLogId))
      setSelectedVisitorLog(log)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDetailChanged = async () => {
    if (!selectedVisitorLog) return
    const fresh = await getVisitor(selectedVisitorLog.visitorLogId)
    setSelectedVisitorLog(fresh)
    load()
  }

  const runInlineAction = async (event, visitorLogId, action) => {
    event.stopPropagation()
    setError('')
    setBusyId(visitorLogId)
    try {
      await action(visitorLogId)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const goToAllVisitors = () => {
    closePopup()
    navigate('/dashboard/visitors')
  }

  return (
    <>
      <button type="button" className="notice-bell" aria-label="Visitor notifications" onClick={openPopup}>
        <Icon paths={VISITOR_ICON} size={20} />
        {unreadCount > 0 && <span className="notice-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {popupOpen && (
        <Modal
          title={selectedVisitorLog ? `Visitor #${selectedVisitorLog.visitorLogId}` : 'Visitor Notifications'}
          subtitle={selectedVisitorLog ? undefined : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          onClose={closePopup}
        >
          {selectedVisitorLog ? (
            <div>
              <button type="button" className="table-link-btn notice-bell-back" onClick={() => setSelectedVisitorLog(null)}>
                ← Back to notifications
              </button>
              {error && <p className="auth-banner-error">{error}</p>}
              <VisitorDetail
                visitorLog={selectedVisitorLog}
                onChanged={handleDetailChanged}
                onDeleted={() => setSelectedVisitorLog(null)}
              />
            </div>
          ) : sortedNotifications.length === 0 ? (
            <p className="table-empty">No visitor notifications yet.</p>
          ) : (
            <>
              {error && <p className="auth-banner-error">{error}</p>}
              <ul className="notice-bell-list">
                {sortedNotifications.slice(0, 8).map((notification) => {
                  const log = logsByVisitorLogId[notification.visitorLogId]
                  return (
                    <li key={notification.visitorNotificationId} className={notification.isRead ? '' : 'unread'}>
                      <button type="button" className="notice-bell-item-btn" onClick={() => openNotification(notification)}>
                        <NotificationAvatar visitorLogId={notification.visitorLogId} attachment={log?.attachments?.[0]} />
                        <span className="notice-bell-item-title">{notification.message}</span>
                      </button>
                      <div className="notice-bell-item-side">
                        <span className="notice-bell-item-date">{new Date(notification.createdOn).toLocaleDateString()}</span>
                        {log?.canApprove && log?.canReject && (
                          <div className="notice-bell-inline-actions">
                            <button
                              type="button"
                              className="notice-bell-action-approve"
                              aria-label="Approve"
                              title="Approve"
                              disabled={busyId === notification.visitorLogId}
                              onClick={(event) => runInlineAction(event, notification.visitorLogId, approveVisitor)}
                            >
                              <Icon paths={TICK_ICON_PATHS} size={15} strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              className="notice-bell-action-reject"
                              aria-label="Reject"
                              title="Reject"
                              disabled={busyId === notification.visitorLogId}
                              onClick={(event) => runInlineAction(event, notification.visitorLogId, rejectVisitor)}
                            >
                              <Icon paths={CROSS_ICON_PATHS} size={15} strokeWidth={3} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="form-actions">
                <button type="button" className="table-secondary-btn" onClick={goToAllVisitors}>
                  View all visitors
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
