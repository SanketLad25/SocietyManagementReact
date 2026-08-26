import { useEffect, useState } from 'react'
import { SelectField } from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createComplaint, uploadComplaintAttachments } from '../../api/complaints.js'
import { listComplaintCategories } from '../../api/complaintCategories.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const PRIORITIES = ['Low', 'Medium', 'High']
const ACCEPTED_PHOTO_TYPES = '.png,.jpg,.jpeg'
const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validate(values) {
  const errors = {}

  if (!values.categoryId) {
    errors.categoryId = 'Category is required.'
  }

  if (!values.description.trim()) {
    errors.description = 'Description is required.'
  }

  return errors
}

export default function ComplaintForm({ onClose, onSaved }) {
  const [values, setValues] = useState({ categoryId: '', description: '', priority: 'Medium' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const [categories, setCategories] = useState([])
  const [categoriesStatus, setCategoriesStatus] = useState('loading')
  const [pendingFiles, setPendingFiles] = useState([])
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    listComplaintCategories()
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
    setTouched({ categoryId: true, description: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    try {
      const created = await createComplaint({
        categoryId: Number(values.categoryId),
        description: values.description.trim(),
        priority: values.priority,
      })

      if (pendingFiles.length > 0) {
        try {
          await uploadComplaintAttachments(created.complaintId, pendingFiles, 'Complaint')
        } catch (uploadErr) {
          setStatus('idle')
          setServerError(`Complaint submitted, but photo upload failed: ${uploadErr.message}`)
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
    setPhotoError('')

    const accepted = []
    for (const file of files) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
      if (!ACCEPTED_PHOTO_TYPES.includes(extension)) {
        setPhotoError(`"${file.name}" isn't a supported photo type.`)
        continue
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setPhotoError(`"${file.name}" is larger than 20 MB.`)
        continue
      }
      accepted.push(file)
    }

    setPendingFiles((prev) => [...prev, ...accepted])
  }

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <SidePanel
      title="Raise Complaint"
      subtitle="Tell us what's wrong and we'll get it sorted."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="complaint-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Submitting…' : 'Submit Complaint'}
          </button>
        </>
      }
    >
      <form id="complaint-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <SelectField
        id="categoryId"
        label="Category"
        value={values.categoryId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.categoryId ? errors.categoryId : undefined}
        disabled={categoriesStatus === 'loading'}
        hint={categoriesStatus === 'error' ? 'Could not load categories — try again.' : undefined}
      >
        <option value="">{categoriesStatus === 'loading' ? 'Loading categories…' : 'Select a category'}</option>
        {categories.map((category) => (
          <option key={category.complaintCategoryId} value={category.complaintCategoryId}>
            {category.categoryName}
          </option>
        ))}
      </SelectField>

      <div className="field">
        <label htmlFor="description">Description</label>
        <div className="field-control">
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

      <SelectField id="priority" label="Priority" value={values.priority} onChange={handleChange}>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </SelectField>

      <div className="field">
        <label htmlFor="photos">Photos (optional)</label>
        <input id="photos" type="file" multiple accept={ACCEPTED_PHOTO_TYPES} onChange={handleFilePick} />
        {photoError && <p className="field-error">{photoError}</p>}
        <p className="field-hint">PNG or JPG — up to 20 MB each.</p>

        {pendingFiles.length > 0 && (
          <ul className="notice-attachment-list">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>
                  {file.name} <span className="table-hint">({formatFileSize(file.size)})</span>
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
