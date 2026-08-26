import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  approveVisitor,
  checkInVisitor,
  checkOutVisitor,
  deleteVisitor,
  fetchVisitorAttachmentBlob,
  listVisitors,
  rejectVisitor,
  subscribeToVisitorsChanged,
} from '../../api/visitors.js'
import { getSession } from '../../api/session.js'
import { isCommitteeRole, VISITOR_GATE_ROLES } from '../../config/roles.js'
import Icon from '../../components/Icon.jsx'
import Modal from '../../components/Modal.jsx'
import VisitorForm from './VisitorForm.jsx'
import '../../styles/dataTable.css'

const PERSON_ICON_PATHS = ['M8 20a4 4 0 0 1 8 0', 'M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z']
const EYE_ICON_PATHS = ['M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z']
const TICK_ICON_PATHS = ['M5 12.5l4.5 4.5L19 7']
const CROSS_ICON_PATHS = ['M6 6l12 12', 'M18 6L6 18']
const TRASH_ICON_PATHS = [
  'M4 7h16',
  'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  'M10 11v6',
  'M14 11v6',
]

// Lazily loads a visitor row's first photo as a small thumbnail (an authenticated fetch, so a
// plain <img src> can't hit the attachment endpoint directly), and opens a larger preview modal
// on click rather than a new tab — a different interaction than VisitorDetail's own gallery, per
// this feature's own requirement.
function VisitorRowThumb({ visitorLogId, attachment, onOpen }) {
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

  if (!attachment) {
    return (
      <span className="visitor-row-thumb visitor-row-thumb-placeholder" aria-hidden="true">
        <Icon paths={PERSON_ICON_PATHS} size={18} />
      </span>
    )
  }

  return (
    <button
      type="button"
      className="visitor-row-thumb-btn"
      onClick={() => onOpen(visitorLogId, attachment)}
      title={attachment.fileName}
      aria-label={`View photo of ${attachment.fileName}`}
    >
      {url ? (
        <img className="visitor-row-thumb" src={url} alt="" />
      ) : (
        <span className="visitor-row-thumb visitor-row-thumb-placeholder" aria-hidden="true" />
      )}
    </button>
  )
}

const STATUSES = ['PendingApproval', 'Approved', 'Rejected', 'CheckedIn', 'CheckedOut', 'Cancelled']
const STATUS_LABELS = {
  PendingApproval: 'Pending Approval',
  Approved: 'Approved',
  Rejected: 'Rejected',
  CheckedIn: 'Checked In',
  CheckedOut: 'Checked Out',
  Cancelled: 'Cancelled',
}
const STATUS_BADGE = {
  PendingApproval: 'badge-warning',
  Approved: 'badge-primary',
  Rejected: 'badge-danger',
  CheckedIn: 'badge-success',
  CheckedOut: 'badge-muted',
  Cancelled: 'badge-neutral',
}

function isToday(dateString) {
  if (!dateString) return false
  const date = new Date(dateString)
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

export default function VisitorList() {
  const session = getSession()
  const canManage = isCommitteeRole(session?.role)
  const canLog = VISITOR_GATE_ROLES.includes(session?.role)
  const navigate = useNavigate()

  const [visitors, setVisitors] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [todayOnly, setTodayOnly] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [infoMessage, setInfoMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  const load = async (params) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listVisitors(params)
      setVisitors(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    load({})
    const unsubscribe = subscribeToVisitorsChanged(() => load({ status: statusFilter, search }))
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    load({ status: statusFilter, search })
  }

  const visibleVisitors = todayOnly && !statusFilter && !search
    ? visitors.filter((v) => isToday(v.entryTime || v.createdOn))
    : visitors

  const runAction = async (visitorLogId, action) => {
    setActionError('')
    setBusyId(visitorLogId)
    try {
      await action(visitorLogId)
      await load({ status: statusFilter, search })
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleCreated = async (_created, photoWarning) => {
    setFormOpen(false)
    setInfoMessage(photoWarning || '')
    await load({ status: statusFilter, search })
  }

  // A fresh fetch, independent of whatever object URL the row's own small thumbnail is holding —
  // the thumb can revoke its URL on unmount (e.g. the list reloads) while this modal is still
  // open, so they can't safely share one blob URL's lifetime.
  const handleOpenPreview = async (visitorLogId, attachment) => {
    try {
      const blob = await fetchVisitorAttachmentBlob(visitorLogId, attachment)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
  }

  const handleDelete = async (visitor) => {
    if (!window.confirm(`Delete this visitor entry for "${visitor.primaryVisitorName}"? This cannot be undone.`)) {
      return
    }
    await runAction(visitor.visitorLogId, deleteVisitor)
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Visitors</h2>
          <p>Log visitor entries and exits at the security gate.</p>
        </div>
        <div className="table-header-actions">
          {canManage && (
            <button type="button" className="table-secondary-btn" onClick={() => navigate('/dashboard/visitors/categories')}>
              Manage Categories
            </button>
          )}
          {canLog && (
            <button type="button" className="table-primary-btn" onClick={() => setFormOpen(true)}>
              + Log Visitor
            </button>
          )}
        </div>
      </div>

      <form className="table-search table-search-wide" onSubmit={handleFilterSubmit}>
        <input type="search" placeholder="Search by visitor, mobile, or flat…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
        <label className="auth-checkbox" style={{ marginLeft: 12 }}>
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
            disabled={Boolean(statusFilter || search)}
          />
          Today only
        </label>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}
      {actionError && <p className="auth-banner-error">{actionError}</p>}
      {infoMessage && <p className="auth-banner-error">{infoMessage}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading visitors…</p>
      ) : visibleVisitors.length === 0 ? (
        <p className="table-empty">No visitor entries found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Time</th>
                <th>Flat</th>
                <th>Visitor</th>
                <th>Category</th>
                <th>Party size</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleVisitors.map((visitor) => (
                <tr key={visitor.visitorLogId}>
                  <td>
                    <VisitorRowThumb
                      visitorLogId={visitor.visitorLogId}
                      attachment={visitor.attachments?.[0]}
                      onOpen={handleOpenPreview}
                    />
                  </td>
                  <td>{new Date(visitor.entryTime || visitor.createdOn).toLocaleString()}</td>
                  <td>{visitor.flatNo || '—'}</td>
                  <td>
                    {visitor.primaryVisitorName}
                    {visitor.partySize > 1 && <span className="table-hint"> +{visitor.partySize - 1}</span>}
                  </td>
                  <td>{visitor.categoryName}</td>
                  <td>{visitor.partySize}</td>
                  <td>
                    <span className={`table-badge ${STATUS_BADGE[visitor.status] || 'badge-neutral'}`}>
                      {STATUS_LABELS[visitor.status] || visitor.status}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-view"
                      aria-label="View"
                      title="View"
                      onClick={() => navigate(`/dashboard/visitors/${visitor.visitorLogId}`)}
                    >
                      <Icon paths={EYE_ICON_PATHS} size={16} />
                    </button>
                    {visitor.canApprove && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-approve"
                        aria-label="Approve"
                        title="Approve"
                        disabled={busyId === visitor.visitorLogId}
                        onClick={() => runAction(visitor.visitorLogId, approveVisitor)}
                      >
                        <Icon paths={TICK_ICON_PATHS} size={16} strokeWidth={3} />
                      </button>
                    )}
                    {visitor.canReject && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-reject"
                        aria-label="Reject"
                        title="Reject"
                        disabled={busyId === visitor.visitorLogId}
                        onClick={() => runAction(visitor.visitorLogId, rejectVisitor)}
                      >
                        <Icon paths={CROSS_ICON_PATHS} size={16} strokeWidth={3} />
                      </button>
                    )}
                    {visitor.canCheckIn && (
                      <button
                        type="button"
                        className="table-link-btn"
                        disabled={busyId === visitor.visitorLogId}
                        onClick={() => runAction(visitor.visitorLogId, checkInVisitor)}
                      >
                        Check In
                      </button>
                    )}
                    {visitor.canCheckOut && (
                      <button
                        type="button"
                        className="table-link-btn"
                        disabled={busyId === visitor.visitorLogId}
                        onClick={() => runAction(visitor.visitorLogId, checkOutVisitor)}
                      >
                        Check Out
                      </button>
                    )}
                    {visitor.canDelete && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-delete"
                        aria-label="Delete"
                        title="Delete"
                        disabled={busyId === visitor.visitorLogId}
                        onClick={() => handleDelete(visitor)}
                      >
                        <Icon paths={TRASH_ICON_PATHS} size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && <VisitorForm onClose={() => setFormOpen(false)} onCreated={handleCreated} />}

      {previewUrl && (
        <Modal title="Visitor photo" onClose={handleClosePreview}>
          <img className="visitor-photo-preview-large" src={previewUrl} alt="" />
        </Modal>
      )}
    </div>
  )
}
