import { useState } from 'react'
import { openNoticeAttachment } from '../../api/notices.js'

const PRIORITY_BADGE = {
  Normal: 'badge-neutral',
  Important: 'badge-warning',
  Urgent: 'badge-danger',
}

export default function NoticeDetail({ notice }) {
  const [openingId, setOpeningId] = useState(null)
  const [error, setError] = useState('')

  const handleOpen = async (attachment) => {
    setOpeningId(attachment.noticeAttachmentId)
    setError('')
    try {
      await openNoticeAttachment(notice.noticeId, attachment)
    } catch (err) {
      setError(err.message)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="notice-detail">
      <div className="notice-detail-badges">
        <span className="table-badge badge-primary">{notice.categoryName}</span>
        <span className={`table-badge ${PRIORITY_BADGE[notice.priority] || 'badge-neutral'}`}>{notice.priority}</span>
        {notice.status === 'Draft' && <span className="table-badge badge-neutral">Draft</span>}
      </div>

      <h3>{notice.title}</h3>
      <p className="notice-detail-meta">
        Posted {new Date(notice.publishDate).toLocaleString()} by {notice.createdByName || 'Unknown'}
        {notice.expiryDate && <> · Expires {new Date(notice.expiryDate).toLocaleDateString()}</>}
      </p>

      <p className="notice-detail-description">{notice.description}</p>

      {notice.attachments.length > 0 && (
        <div className="notice-detail-attachments">
          <h4>Attachments</h4>
          {error && <p className="auth-banner-error">{error}</p>}
          <ul>
            {notice.attachments.map((attachment) => (
              <li key={attachment.noticeAttachmentId}>
                <button
                  type="button"
                  className="table-link-btn"
                  disabled={openingId === attachment.noticeAttachmentId}
                  onClick={() => handleOpen(attachment)}
                >
                  {openingId === attachment.noticeAttachmentId ? 'Opening…' : attachment.fileName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
