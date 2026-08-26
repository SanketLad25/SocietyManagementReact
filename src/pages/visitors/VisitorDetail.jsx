import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  approveVisitor,
  checkInVisitor,
  checkOutVisitor,
  deleteVisitor,
  fetchVisitorAttachmentBlob,
  getVisitor,
  openVisitorAttachment,
  rejectVisitor,
  uploadVisitorPhotos,
} from '../../api/visitors.js'
import { getSession } from '../../api/session.js'
import { VISITOR_GATE_ROLES } from '../../config/roles.js'
import CameraCapture from '../../components/CameraCapture.jsx'
import Icon from '../../components/Icon.jsx'
import '../../styles/dataTable.css'

const PERSON_ICON_PATHS = ['M8 20a4 4 0 0 1 8 0', 'M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z']
const TICK_ICON_PATHS = ['M5 12.5l4.5 4.5L19 7']
const CROSS_ICON_PATHS = ['M6 6l12 12', 'M18 6L6 18']
const TRASH_ICON_PATHS = [
  'M4 7h16',
  'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  'M10 11v6',
  'M14 11v6',
]

const ACCEPTED_PHOTO_TYPES = '.png,.jpg,.jpeg'
const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024

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

// The primary/first photo, shown as a profile-style thumbnail beside the visitor's details in
// the main card — its own small thumbnail fetch, separate from PhotoGallery's, since it's a
// single image rendered in a different layout, not part of the grid of additional photos.
function ProfilePhoto({ visitorLogId, attachment }) {
  const [url, setUrl] = useState('')
  const [opening, setOpening] = useState(false)

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
      .catch(() => {
        // Left as a placeholder — the photo is still openable full-size on click, which retries.
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [visitorLogId, attachment])

  if (!attachment) {
    return (
      <span className="visitor-profile-photo visitor-profile-photo-placeholder" aria-hidden="true">
        <Icon paths={PERSON_ICON_PATHS} size={36} />
      </span>
    )
  }

  const handleOpen = async () => {
    setOpening(true)
    try {
      await openVisitorAttachment(visitorLogId, attachment)
    } catch (err) {
      window.alert(err.message)
    } finally {
      setOpening(false)
    }
  }

  return (
    <button
      type="button"
      className="visitor-profile-photo-btn"
      onClick={handleOpen}
      disabled={opening}
      title={attachment.fileName}
      aria-label={`Open photo ${attachment.fileName}`}
    >
      {url ? (
        <img className="visitor-profile-photo" src={url} alt="" />
      ) : (
        <span className="visitor-profile-photo visitor-profile-photo-placeholder" aria-hidden="true" />
      )}
    </button>
  )
}

function PhotoGallery({ visitorLogId, attachments }) {
  const [openingId, setOpeningId] = useState(null)
  const [thumbnails, setThumbnails] = useState({})
  const urlsRef = useRef({})

  // Thumbnails need an authenticated fetch (a plain <img src> can't carry the Bearer token), so
  // each one is loaded as a blob object URL rather than pointed straight at the API endpoint.
  useEffect(() => {
    let cancelled = false

    async function loadThumbnails() {
      for (const attachment of attachments) {
        const id = attachment.visitorAttachmentId
        if (urlsRef.current[id]) continue
        try {
          const blob = await fetchVisitorAttachmentBlob(visitorLogId, attachment)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          urlsRef.current[id] = url
          setThumbnails((prev) => ({ ...prev, [id]: url }))
        } catch {
          // Left as a placeholder circle below — the photo is still openable full-size on click,
          // which retries the fetch itself and surfaces its own error if that fails too.
        }
      }
    }

    loadThumbnails()
    return () => {
      cancelled = true
    }
  }, [visitorLogId, attachments])

  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  const handleOpen = async (attachment) => {
    setOpeningId(attachment.visitorAttachmentId)
    try {
      await openVisitorAttachment(visitorLogId, attachment)
    } catch (err) {
      window.alert(err.message)
    } finally {
      setOpeningId(null)
    }
  }

  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="photo-gallery">
      {attachments.map((attachment) => (
        <button
          type="button"
          key={attachment.visitorAttachmentId}
          className="photo-gallery-item"
          disabled={openingId === attachment.visitorAttachmentId}
          onClick={() => handleOpen(attachment)}
          title={attachment.fileName}
          aria-label={`Open photo ${attachment.fileName}`}
        >
          {thumbnails[attachment.visitorAttachmentId] ? (
            <img className="photo-gallery-thumb" src={thumbnails[attachment.visitorAttachmentId]} alt="" />
          ) : (
            <span className="photo-gallery-thumb photo-gallery-thumb-placeholder" aria-hidden="true" />
          )}
          <span className="photo-gallery-caption">{attachment.fileName}</span>
        </button>
      ))}
    </div>
  )
}

function PhotoUploader({ visitorLogId, onUploaded }) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const [cameraOpen, setCameraOpen] = useState(false)

  const uploadFiles = async (files) => {
    setError('')

    const accepted = []
    for (const file of files) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
      if (!ACCEPTED_PHOTO_TYPES.includes(extension)) {
        setError(`"${file.name}" isn't a supported photo type.`)
        continue
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setError(`"${file.name}" is larger than 20 MB.`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length === 0) return

    setStatus('uploading')
    try {
      await uploadVisitorPhotos(visitorLogId, accepted)
      await onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  const handleFilePick = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    await uploadFiles(files)
  }

  const handleCameraCapture = async (file) => {
    setCameraOpen(false)
    await uploadFiles([file])
  }

  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label htmlFor="visitorPhotos">Add photo(s)</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input id="visitorPhotos" type="file" multiple accept={ACCEPTED_PHOTO_TYPES} onChange={handleFilePick} disabled={status === 'uploading'} />
        <button type="button" className="table-secondary-btn" disabled={status === 'uploading'} onClick={() => setCameraOpen(true)}>
          Take Photo
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      <p className="field-hint">PNG or JPG — up to 20 MB each. "Take Photo" uses your device's camera.</p>
      {cameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}

export default function VisitorDetail({ visitorLog: visitorLogProp, onChanged, onDeleted }) {
  const params = useParams()
  const navigate = useNavigate()
  const session = getSession()
  const isGateRole = VISITOR_GATE_ROLES.includes(session?.role)
  const isRouted = !visitorLogProp

  const [visitorLog, setVisitorLog] = useState(visitorLogProp || null)
  const [status, setStatus] = useState(visitorLogProp ? 'idle' : 'loading')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionStatus, setActionStatus] = useState('idle')

  useEffect(() => {
    if (!isRouted) return
    getVisitor(params.visitorLogId)
      .then((data) => {
        setVisitorLog(data)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.visitorLogId])

  useEffect(() => {
    if (visitorLogProp) {
      setVisitorLog(visitorLogProp)
    }
  }, [visitorLogProp])

  const refresh = async () => {
    const fresh = await getVisitor(visitorLog.visitorLogId)
    setVisitorLog(fresh)
    onChanged?.()
    return fresh
  }

  const runAction = async (action) => {
    setActionError('')
    setActionStatus('busy')
    try {
      await action(visitorLog.visitorLogId)
      await refresh()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionStatus('idle')
    }
  }

  // Deleting removes the row entirely, so the normal runAction -> refresh() flow (which re-fetches
  // this same visitorLogId) would 404 — instead close out to wherever makes sense for how this
  // component is mounted: back to the list on the routed page, or back to the notification list
  // when embedded in VisitorBell's popup.
  const handleDelete = async () => {
    if (!window.confirm(`Delete this visitor entry for "${visitorLog.primaryVisitorName}"? This cannot be undone.`)) {
      return
    }

    setActionError('')
    setActionStatus('busy')
    try {
      await deleteVisitor(visitorLog.visitorLogId)
      if (onDeleted) {
        onDeleted()
      } else if (isRouted) {
        navigate('/dashboard/visitors')
      }
    } catch (err) {
      setActionError(err.message)
      setActionStatus('idle')
    }
  }

  if (status === 'loading') {
    return <p className="table-empty">Loading visitor entry…</p>
  }

  if (status === 'error') {
    return <p className="auth-banner-error">{error}</p>
  }

  if (!visitorLog) {
    return <p className="table-empty">Visitor entry not found.</p>
  }

  return (
    <div>
      {isRouted && (
        <div className="table-page-header">
          <div>
            <h2>Visitor #{visitorLog.visitorLogId}</h2>
            <p>{visitorLog.categoryName}</p>
          </div>
          <button type="button" className="table-secondary-btn" onClick={() => navigate('/dashboard/visitors')}>
            Back to list
          </button>
        </div>
      )}

      <div className="detail-badges">
        <span className={`table-badge ${STATUS_BADGE[visitorLog.status] || 'badge-neutral'}`}>
          {STATUS_LABELS[visitorLog.status] || visitorLog.status}
        </span>
        <span className="table-badge badge-primary">{visitorLog.categoryName}</span>
        {visitorLog.approvalRequired && <span className="table-badge badge-neutral">Approval required</span>}
      </div>

      <div className="form-card" style={{ marginTop: 12 }}>
        <div className="visitor-profile-header">
          <ProfilePhoto visitorLogId={visitorLog.visitorLogId} attachment={visitorLog.attachments?.[0]} />

          <div className="visitor-profile-details">
            <p>
              <strong>{visitorLog.primaryVisitorName}</strong>
              {visitorLog.partySize > 1 ? ` and ${visitorLog.partySize - 1} other(s)` : ''}
              {' — Flat '}
              {visitorLog.flatNo}
            </p>
            {visitorLog.primaryMobile && <p className="field-hint">Mobile: {visitorLog.primaryMobile}</p>}
            {visitorLog.vehicleNo && <p className="field-hint">Vehicle: {visitorLog.vehicleNo}</p>}
            {visitorLog.companyName && <p className="field-hint">Company: {visitorLog.companyName}</p>}
            {visitorLog.purpose && <p className="field-hint">Purpose: {visitorLog.purpose}</p>}
            {visitorLog.memberNames?.length > 0 && (
              <p className="field-hint">Others in party: {visitorLog.memberNames.join(', ')}</p>
            )}
            <p className="field-hint">
              Logged by {visitorLog.loggedByName || 'Unknown'} on {new Date(visitorLog.createdOn).toLocaleString()}
            </p>
            {visitorLog.entryTime && <p className="field-hint">Entry: {new Date(visitorLog.entryTime).toLocaleString()}</p>}
            {visitorLog.exitTime && (
              <p className="field-hint">
                Exit: {new Date(visitorLog.exitTime).toLocaleString()}
                {visitorLog.checkedOutByName ? ` — checked out by ${visitorLog.checkedOutByName}` : ''}
              </p>
            )}
          </div>
        </div>

        {visitorLog.attachments?.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <p className="table-section-title">Additional photos</p>
            <PhotoGallery visitorLogId={visitorLog.visitorLogId} attachments={visitorLog.attachments.slice(1)} />
          </div>
        )}

        {isGateRole && <PhotoUploader visitorLogId={visitorLog.visitorLogId} onUploaded={refresh} />}
      </div>

      {actionError && <p className="auth-banner-error" style={{ marginTop: 12 }}>{actionError}</p>}

      {(visitorLog.canApprove ||
        visitorLog.canReject ||
        visitorLog.canCheckIn ||
        visitorLog.canCheckOut ||
        visitorLog.canDelete) && (
        <div className="form-actions" style={{ marginTop: 16 }}>
          {visitorLog.canApprove && (
            <button
              type="button"
              className="visitor-action-icon-btn visitor-action-approve"
              aria-label="Approve"
              title="Approve"
              disabled={actionStatus === 'busy'}
              onClick={() => runAction(approveVisitor)}
            >
              <Icon paths={TICK_ICON_PATHS} size={18} strokeWidth={3} />
            </button>
          )}
          {visitorLog.canReject && (
            <button
              type="button"
              className="visitor-action-icon-btn visitor-action-reject"
              aria-label="Reject"
              title="Reject"
              disabled={actionStatus === 'busy'}
              onClick={() => runAction(rejectVisitor)}
            >
              <Icon paths={CROSS_ICON_PATHS} size={18} strokeWidth={3} />
            </button>
          )}
          {visitorLog.canCheckIn && (
            <button type="button" className="auth-submit" disabled={actionStatus === 'busy'} onClick={() => runAction(checkInVisitor)}>
              Check In
            </button>
          )}
          {visitorLog.canCheckOut && (
            <button type="button" className="auth-submit" disabled={actionStatus === 'busy'} onClick={() => runAction(checkOutVisitor)}>
              Check Out
            </button>
          )}
          {visitorLog.canDelete && (
            <button
              type="button"
              className="visitor-action-icon-btn visitor-action-delete"
              aria-label="Delete"
              title="Delete"
              disabled={actionStatus === 'busy'}
              onClick={handleDelete}
            >
              <Icon paths={TRASH_ICON_PATHS} size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
