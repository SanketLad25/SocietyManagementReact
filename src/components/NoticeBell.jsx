import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listNotices, markNoticeRead, subscribeToNoticesChanged } from '../api/notices.js'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import NoticeDetail from '../pages/notices/NoticeDetail.jsx'
import '../styles/noticeBell.css'

const BELL_ICON = ['M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0']

const PRIORITY_BADGE = {
  Normal: 'badge-neutral',
  Important: 'badge-warning',
  Urgent: 'badge-danger',
}

const REFRESH_INTERVAL_MS = 60000

export default function NoticeBell() {
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])
  const [popupOpen, setPopupOpen] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState(null)

  const load = () => {
    listNotices({ sortBy: 'priority' })
      .then(setNotices)
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const unsubscribe = subscribeToNoticesChanged(load)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const unreadCount = notices.filter((n) => !n.isRead).length
  const sortedNotices = [...notices].sort((a, b) => Number(a.isRead) - Number(b.isRead))

  const openPopup = () => {
    load()
    setSelectedNotice(null)
    setPopupOpen(true)
  }

  const closePopup = () => {
    setPopupOpen(false)
    setSelectedNotice(null)
  }

  const openNotice = async (notice) => {
    setSelectedNotice(notice)
    if (!notice.isRead) {
      try {
        await markNoticeRead(notice.noticeId)
        load()
      } catch {
        // non-fatal — viewing still works even if the read-marking call fails
      }
    }
  }

  const goToAllNotices = () => {
    closePopup()
    navigate('/dashboard/notices')
  }

  return (
    <>
      <button type="button" className="notice-bell" aria-label="Notices" onClick={openPopup}>
        <Icon paths={BELL_ICON} size={20} />
        {unreadCount > 0 && <span className="notice-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {popupOpen && (
        <Modal
          title={selectedNotice ? selectedNotice.title : 'Notices'}
          subtitle={selectedNotice ? undefined : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          onClose={closePopup}
        >
          {selectedNotice ? (
            <div>
              <button type="button" className="table-link-btn notice-bell-back" onClick={() => setSelectedNotice(null)}>
                ← Back to notices
              </button>
              <NoticeDetail notice={selectedNotice} />
            </div>
          ) : sortedNotices.length === 0 ? (
            <p className="table-empty">No notices yet.</p>
          ) : (
            <>
              <ul className="notice-bell-list">
                {sortedNotices.slice(0, 8).map((notice) => (
                  <li key={notice.noticeId} className={notice.isRead ? '' : 'unread'}>
                    <button type="button" onClick={() => openNotice(notice)}>
                      <span className={`table-badge ${PRIORITY_BADGE[notice.priority] || 'badge-neutral'}`}>{notice.priority}</span>
                      <span className="notice-bell-item-title">{notice.title}</span>
                      <span className="notice-bell-item-date">{new Date(notice.publishDate).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="form-actions">
                <button type="button" className="table-secondary-btn" onClick={goToAllNotices}>
                  View all notices
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
