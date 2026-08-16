import { useState } from 'react'
import {
  addComplaintComment,
  assignComplaint,
  confirmResolution,
  openComplaintAttachment,
  updateComplaintStatus,
  uploadComplaintAttachments,
} from '../../api/complaints.js'
import { getSession } from '../../api/session.js'
import FormField from '../../components/FormField.jsx'
import '../../styles/dataTable.css'

const PRIORITY_BADGE = { Low: 'badge-neutral', Medium: 'badge-warning', High: 'badge-danger' }
const STATUS_BADGE = {
  Open: 'badge-neutral',
  Assigned: 'badge-primary',
  InProgress: 'badge-warning',
  Resolved: 'badge-success',
  Closed: 'badge-muted',
}
const STATUS_ORDER = ['Open', 'Assigned', 'InProgress', 'Resolved', 'Closed']
const ACCEPTED_PHOTO_TYPES = '.png,.jpg,.jpeg'
const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024

function AssignForm({ complaint, onAssigned }) {
  const [values, setValues] = useState({ assignedToName: '', assignedToContact: '', assignmentNotes: '' })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!values.assignedToName.trim()) {
      setError('Staff name is required.')
      return
    }

    setError('')
    setStatus('submitting')
    try {
      await assignComplaint(complaint.complaintId, {
        assignedToName: values.assignedToName.trim(),
        assignedToContact: values.assignedToContact.trim() || undefined,
        assignmentNotes: values.assignmentNotes.trim() || undefined,
      })
      onAssigned()
    } catch (err) {
      setStatus('idle')
      setError(err.message)
    }
  }

  return (
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      <p className="table-section-title">Assign to maintenance staff</p>
      {error && <p className="auth-banner-error">{error}</p>}
      <FormField
        id="assignedToName"
        label="Staff name"
        placeholder="e.g. Ramesh (Plumber)"
        value={values.assignedToName}
        onChange={handleChange}
      />
      <FormField
        id="assignedToContact"
        label="Contact number (optional)"
        value={values.assignedToContact}
        onChange={handleChange}
      />
      <FormField id="assignmentNotes" label="Notes (optional)" value={values.assignmentNotes} onChange={handleChange} />
      <div className="form-actions">
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </form>
  )
}

function StatusAndCommentPanel({ complaint, onChanged }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const currentIndex = STATUS_ORDER.indexOf(complaint.status)
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIndex + 1] : null

  const handleAdvance = async () => {
    if (!nextStatus) return
    setError('')
    setStatus('advancing')
    try {
      await updateComplaintStatus(complaint.complaintId, nextStatus, comment.trim() || undefined)
      setComment('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) {
      setError('Enter a comment first.')
      return
    }
    setError('')
    setStatus('commenting')
    try {
      await addComplaintComment(complaint.complaintId, comment.trim())
      setComment('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="form-card" style={{ marginTop: 16 }}>
      <p className="table-section-title">Update this complaint</p>
      {error && <p className="auth-banner-error">{error}</p>}
      <div className="field">
        <label htmlFor="comment">Comment (optional)</label>
        <div className="field-control">
          <textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="table-secondary-btn" disabled={status !== 'idle'} onClick={handleComment}>
          {status === 'commenting' ? 'Posting…' : 'Post comment'}
        </button>
        {nextStatus && (
          <button type="button" className="auth-submit" disabled={status !== 'idle'} onClick={handleAdvance}>
            {status === 'advancing' ? 'Updating…' : `Mark as ${nextStatus}`}
          </button>
        )}
      </div>
    </div>
  )
}

function ConfirmResolutionButton({ complaint, onChanged }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setStatus('submitting')
    setError('')
    try {
      await confirmResolution(complaint.complaintId)
      onChanged()
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="form-card" style={{ marginTop: 16 }}>
      <p className="table-section-title">Is this resolved?</p>
      {error && <p className="auth-banner-error">{error}</p>}
      <p className="field-hint">Confirming will close this complaint. This step is optional.</p>
      <div className="form-actions">
        <button type="button" className="auth-submit" disabled={status === 'submitting'} onClick={handleConfirm}>
          {status === 'submitting' ? 'Confirming…' : 'Confirm Resolution'}
        </button>
      </div>
    </div>
  )
}

function PhotoGallery({ complaintId, title, attachments, emptyHint }) {
  const [openingId, setOpeningId] = useState(null)

  const handleOpen = async (attachment) => {
    setOpeningId(attachment.complaintAttachmentId)
    try {
      await openComplaintAttachment(complaintId, attachment)
    } catch (err) {
      window.alert(err.message)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p className="table-section-title">{title}</p>
      {attachments.length === 0 ? (
        <p className="field-hint">{emptyHint}</p>
      ) : (
        <div className="photo-gallery">
          {attachments.map((attachment) => (
            <button
              type="button"
              key={attachment.complaintAttachmentId}
              className="table-link-btn"
              disabled={openingId === attachment.complaintAttachmentId}
              onClick={() => handleOpen(attachment)}
            >
              {openingId === attachment.complaintAttachmentId ? 'Opening…' : attachment.fileName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ResolutionPhotoUploader({ complaintId, onUploaded }) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleFilePick = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
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

    if (accepted.length === 0) {
      return
    }

    setStatus('uploading')
    try {
      await uploadComplaintAttachments(complaintId, accepted, 'Resolution')
      onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label htmlFor="resolutionPhotos">Add resolution photos</label>
      <input
        id="resolutionPhotos"
        type="file"
        multiple
        accept={ACCEPTED_PHOTO_TYPES}
        onChange={handleFilePick}
        disabled={status === 'uploading'}
      />
      {error && <p className="field-error">{error}</p>}
      <p className="field-hint">PNG or JPG — up to 20 MB each.</p>
    </div>
  )
}

function Timeline({ updates }) {
  if (updates.length === 0) {
    return null
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p className="table-section-title">History</p>
      <ul className="complaint-timeline">
        {updates.map((update) => (
          <li key={update.complaintUpdateId}>
            <span className="complaint-timeline-dot" aria-hidden="true" />
            <div>
              <p className="complaint-timeline-text">
                {update.updateType === 'StatusChange' && (
                  <>
                    {update.oldStatus ? `${update.oldStatus} → ${update.newStatus}` : `Raised as ${update.newStatus}`}
                    {update.commentText ? ` — ${update.commentText}` : ''}
                  </>
                )}
                {update.updateType === 'Assignment' && (update.commentText || 'Assigned to maintenance staff')}
                {update.updateType === 'Comment' && update.commentText}
              </p>
              <p className="field-hint">
                {update.createdByName || 'System'} · {new Date(update.createdOn).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ComplaintDetail({ complaint, onChanged }) {
  const session = getSession()
  const isAdmin = session?.role === 'Admin'
  const isAssigned = Boolean(complaint.assignedToName)
  const canAddResolutionPhotos = isAdmin && ['Assigned', 'InProgress', 'Resolved'].includes(complaint.status)
  const canUpdateStatus = isAdmin && isAssigned && complaint.status !== 'Closed'
  const canConfirmResolution = complaint.isOwnComplaint && complaint.status === 'Resolved'

  const complaintPhotos = complaint.attachments.filter((a) => a.attachmentKind === 'Complaint')
  const resolutionPhotos = complaint.attachments.filter((a) => a.attachmentKind === 'Resolution')

  return (
    <div>
      <div className="detail-badges">
        <span className={`table-badge ${PRIORITY_BADGE[complaint.priority] || 'badge-neutral'}`}>{complaint.priority}</span>
        <span className={`table-badge ${STATUS_BADGE[complaint.status] || 'badge-neutral'}`}>{complaint.status}</span>
        <span className="table-badge badge-primary">{complaint.categoryName}</span>
      </div>

      <p style={{ marginTop: 12 }}>{complaint.description}</p>

      <p className="field-hint">
        Raised by {complaint.residentName || complaint.createdByName}
        {complaint.flatNo ? ` — Flat ${complaint.flatNo}` : ''} on {new Date(complaint.createdOn).toLocaleString()}
      </p>

      <PhotoGallery
        complaintId={complaint.complaintId}
        title="Photos"
        attachments={complaintPhotos}
        emptyHint="No photos were attached to this complaint."
      />

      {isAssigned && (
        <div className="form-card" style={{ marginTop: 16 }}>
          <p className="table-section-title">Assigned to</p>
          <p>
            {complaint.assignedToName}
            {complaint.assignedToContact ? ` — ${complaint.assignedToContact}` : ''}
          </p>
          {complaint.assignmentNotes && <p className="field-hint">{complaint.assignmentNotes}</p>}
        </div>
      )}

      {isAdmin && !isAssigned && (
        <div style={{ marginTop: 16 }}>
          <AssignForm complaint={complaint} onAssigned={onChanged} />
        </div>
      )}

      {isAssigned && (
        <PhotoGallery
          complaintId={complaint.complaintId}
          title="Resolution photos"
          attachments={resolutionPhotos}
          emptyHint="No resolution photos yet."
        />
      )}

      {canAddResolutionPhotos && <ResolutionPhotoUploader complaintId={complaint.complaintId} onUploaded={onChanged} />}

      {canUpdateStatus && <StatusAndCommentPanel complaint={complaint} onChanged={onChanged} />}

      {canConfirmResolution && <ConfirmResolutionButton complaint={complaint} onChanged={onChanged} />}

      <Timeline updates={complaint.updates} />
    </div>
  )
}
