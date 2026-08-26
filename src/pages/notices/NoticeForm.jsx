import { useEffect, useState } from 'react'
import FormField, { SelectField } from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import {
  createNotice,
  deleteNoticeAttachment,
  updateNotice,
  uploadNoticeAttachments,
} from '../../api/notices.js'
import { listNoticeCategories } from '../../api/noticeCategories.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const PRIORITIES = ['Normal', 'Important', 'Urgent']
const ACCEPTED_ATTACHMENT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toInitialValues(notice) {
  return {
    title: notice?.title || '',
    description: notice?.description || '',
    categoryId: notice?.categoryId != null ? String(notice.categoryId) : '',
    priority: notice?.priority || 'Normal',
    publishDate: notice ? toDateTimeLocal(notice.publishDate) : toDateTimeLocal(new Date()),
    expiryDate: notice?.expiryDate ? notice.expiryDate.slice(0, 10) : '',
  }
}

function validate(values) {
  const errors = {}

  if (!values.title.trim()) {
    errors.title = 'Title is required.'
  }

  if (!values.description.trim()) {
    errors.description = 'Description is required.'
  }

  if (!values.categoryId) {
    errors.categoryId = 'Category is required.'
  }

  if (!values.publishDate) {
    errors.publishDate = 'Publish date & time is required.'
  }

  if (values.expiryDate && values.publishDate && values.expiryDate < values.publishDate.slice(0, 10)) {
    errors.expiryDate = 'Expiry date must be on or after the publish date.'
  }

  return errors
}

export default function NoticeForm({ notice, onClose, onSaved }) {
  const isEditMode = Boolean(notice)

  const [values, setValues] = useState(() => toInitialValues(notice))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')
  const [categories, setCategories] = useState([])
  const [categoriesStatus, setCategoriesStatus] = useState('loading')
  const [existingAttachments, setExistingAttachments] = useState(notice?.attachments || [])
  const [pendingFiles, setPendingFiles] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [removingAttachmentId, setRemovingAttachmentId] = useState(null)

  useEffect(() => {
    listNoticeCategories()
      .then((data) => {
        setCategories(data.filter((c) => c.isActive))
        setCategoriesStatus('idle')
      })
      .catch(() => setCategoriesStatus('error'))
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value }
    setValues(nextValues)
    if (touched[name]) {
      setErrors(validate(nextValues))
    }
  }

  const handleBlur = (event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(values))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setTouched({ title: true, description: true, categoryId: true, publishDate: true, expiryDate: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      categoryId: Number(values.categoryId),
      priority: values.priority,
      publishDate: values.publishDate,
      expiryDate: values.expiryDate || null,
    }

    try {
      const saved = isEditMode ? await updateNotice(notice.noticeId, payload) : await createNotice(payload)

      if (pendingFiles.length > 0) {
        try {
          await uploadNoticeAttachments(saved.noticeId, pendingFiles)
        } catch (uploadErr) {
          setStatus('idle')
          setServerError(`Notice saved, but attachment upload failed: ${uploadErr.message}`)
          return
        }
      }

      onSaved()
    } catch (err) {
      setStatus('idle')
      setServerError(err.message)
      if (err.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
    }
  }

  const handleFilePick = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setAttachmentError('')

    const accepted = []
    for (const file of files) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
      if (!ACCEPTED_ATTACHMENT_TYPES.includes(extension)) {
        setAttachmentError(`"${file.name}" isn't an allowed file type.`)
        continue
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(`"${file.name}" is larger than 20 MB.`)
        continue
      }
      accepted.push(file)
    }

    setPendingFiles((prev) => [...prev, ...accepted])
  }

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = async (attachment) => {
    if (!window.confirm(`Remove "${attachment.fileName}"?`)) {
      return
    }
    setRemovingAttachmentId(attachment.noticeAttachmentId)
    try {
      await deleteNoticeAttachment(notice.noticeId, attachment.noticeAttachmentId)
      setExistingAttachments((prev) => prev.filter((a) => a.noticeAttachmentId !== attachment.noticeAttachmentId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setRemovingAttachmentId(null)
    }
  }

  return (
    <SidePanel
      title={isEditMode ? 'Edit Notice' : 'New Notice'}
      subtitle={isEditMode ? 'Update this draft notice.' : 'Create a new notice — it stays a draft until you publish it.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="notice-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Save Draft'}
          </button>
        </>
      }
    >
      <form id="notice-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="title"
        label="Notice Title"
        value={values.title}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.title ? errors.title : undefined}
      />

      <div className="field">
        <label htmlFor="description">Description</label>
        <div className={`field-control ${touched.description && errors.description ? 'has-error' : ''}`}>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={values.description}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
        {touched.description && errors.description && <p className="field-error">{errors.description}</p>}
      </div>

      <SelectField
        id="categoryId"
        label="Category"
        value={values.categoryId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.categoryId ? errors.categoryId : undefined}
        disabled={categoriesStatus === 'loading'}
        hint={categoriesStatus === 'error' ? 'Could not load categories.' : undefined}
      >
        <option value="">{categoriesStatus === 'loading' ? 'Loading…' : 'Select a category…'}</option>
        {categories.map((category) => (
          <option key={category.noticeCategoryId} value={category.noticeCategoryId}>
            {category.categoryName}
          </option>
        ))}
      </SelectField>

      <SelectField id="priority" label="Priority" value={values.priority} onChange={handleChange}>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </SelectField>

      <FormField
        id="publishDate"
        label="Publish Date & Time"
        type="datetime-local"
        value={values.publishDate}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.publishDate ? errors.publishDate : undefined}
      />

      <FormField
        id="expiryDate"
        label="Expiry Date (optional)"
        type="date"
        value={values.expiryDate}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.expiryDate ? errors.expiryDate : undefined}
      />

      <div className="field">
        <label htmlFor="attachments">Attachments (optional)</label>
        <input id="attachments" type="file" multiple accept={ACCEPTED_ATTACHMENT_TYPES} onChange={handleFilePick} />
        {attachmentError && <p className="field-error">{attachmentError}</p>}
        <p className="field-hint">PDF, DOC, XLS, PNG, or JPG — up to 20 MB each.</p>

        {existingAttachments.length > 0 && (
          <ul className="notice-attachment-list">
            {existingAttachments.map((attachment) => (
              <li key={attachment.noticeAttachmentId}>
                <span>
                  {attachment.fileName} <span className="table-hint">({formatFileSize(attachment.fileSizeBytes)})</span>
                </span>
                <button
                  type="button"
                  className="table-link-btn danger"
                  disabled={removingAttachmentId === attachment.noticeAttachmentId}
                  onClick={() => removeExistingAttachment(attachment)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {pendingFiles.length > 0 && (
          <ul className="notice-attachment-list">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>
                  {file.name} <span className="table-hint">({formatFileSize(file.size)}, not yet uploaded)</span>
                </span>
                <button type="button" className="table-link-btn danger" onClick={() => removePendingFile(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      </form>
    </SidePanel>
  )
}
