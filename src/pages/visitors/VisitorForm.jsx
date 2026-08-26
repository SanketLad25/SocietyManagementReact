import { useEffect, useState } from 'react'
import FormField, { SelectField } from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import CameraCapture from '../../components/CameraCapture.jsx'
import Icon from '../../components/Icon.jsx'
import { createVisitor, uploadVisitorPhotos } from '../../api/visitors.js'
import { listVisitorCategories } from '../../api/visitorCategories.js'
import { listFlats } from '../../api/flats.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const MOBILE_PATTERN = /^[6-9]\d{9}$/
const ACCEPTED_PHOTO_TYPES = '.png,.jpg,.jpeg'
const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024
const PERSON_ICON_PATHS = ['M8 20a4 4 0 0 1 8 0', 'M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z']

function validate(values, category) {
  const errors = {}

  if (!values.flatId) {
    errors.flatId = 'Flat is required.'
  }

  if (!values.visitorCategoryId) {
    errors.visitorCategoryId = 'Category is required.'
  }

  if (!values.primaryVisitorName.trim()) {
    errors.primaryVisitorName = 'Visitor name is required.'
  }

  if (values.primaryMobile.trim() && !MOBILE_PATTERN.test(values.primaryMobile.trim())) {
    errors.primaryMobile = 'Enter a valid 10-digit mobile number.'
  }

  if (category?.requiresVehicleNo && !values.vehicleNo.trim()) {
    errors.vehicleNo = `Vehicle number is required for ${category.categoryName} visitors.`
  }

  if (category?.requiresCompanyName && !values.companyName.trim()) {
    errors.companyName = `Company name is required for ${category.categoryName} visitors.`
  }

  return errors
}

// Photo capture/upload is staged locally (a plain File, previewed via an object URL) and only
// actually sent to the server as part of handleSubmit, right after the visitor row itself is
// created — the visitor is "logged" by one Log Visitor click, not by an earlier, separate upload
// step, matching the requirement that nothing is saved until that click.
function PhotoPicker({ photoFile, previewUrl, onPick, onRemove }) {
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  const validateAndPick = (file) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!ACCEPTED_PHOTO_TYPES.includes(extension)) {
      setError(`"${file.name}" isn't a supported photo type.`)
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setError(`"${file.name}" is larger than 20 MB.`)
      return
    }
    setError('')
    onPick(file)
  }

  const handleFilePick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) validateAndPick(file)
  }

  const handleCameraCapture = (file) => {
    setCameraOpen(false)
    validateAndPick(file)
  }

  return (
    <div className="field">
      <label>Visitor photo (optional)</label>

      {photoFile ? (
        <div className="visitor-photo-picker-preview">
          <img src={previewUrl} alt="Selected visitor" />
          <button type="button" className="table-link-btn danger" onClick={onRemove}>
            Remove photo
          </button>
        </div>
      ) : (
        <div className="visitor-photo-picker-placeholder">
          <Icon paths={PERSON_ICON_PATHS} size={32} />
        </div>
      )}

      <div className="visitor-photo-picker-actions">
        <label className="table-secondary-btn visitor-photo-picker-upload-btn">
          Upload Image
          <input type="file" accept={ACCEPTED_PHOTO_TYPES} onChange={handleFilePick} hidden />
        </label>
        <button type="button" className="table-secondary-btn" onClick={() => setCameraOpen(true)}>
          Capture Image
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      <p className="field-hint">PNG or JPG — up to 20 MB. Attached when you click Log Visitor.</p>

      {cameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}

export default function VisitorForm({ onClose, onCreated }) {
  const [values, setValues] = useState({
    flatId: '',
    visitorCategoryId: '',
    primaryVisitorName: '',
    primaryMobile: '',
    vehicleNo: '',
    companyName: '',
    partySize: '1',
    purpose: '',
  })
  const [memberNames, setMemberNames] = useState([])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')

  const [flats, setFlats] = useState([])
  const [flatsStatus, setFlatsStatus] = useState('loading')
  const [categories, setCategories] = useState([])
  const [categoriesStatus, setCategoriesStatus] = useState('loading')

  useEffect(() => {
    listFlats().then((data) => {
      setFlats(data)
      setFlatsStatus('idle')
    }).catch(() => setFlatsStatus('error'))

    listVisitorCategories().then((data) => {
      setCategories(data.filter((c) => c.isActive))
      setCategoriesStatus('idle')
    }).catch(() => setCategoriesStatus('error'))
  }, [])

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const selectedCategory = categories.find((c) => String(c.visitorCategoryId) === values.visitorCategoryId)

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value }
    setValues(nextValues)
    if (touched[name]) {
      setErrors(validate(nextValues, categories.find((c) => String(c.visitorCategoryId) === nextValues.visitorCategoryId)))
    }
  }

  const handleBlur = (event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(values, selectedCategory))
  }

  const handleMemberChange = (index, value) => {
    setMemberNames((prev) => prev.map((name, i) => (i === index ? value : name)))
  }

  const addMemberRow = () => setMemberNames((prev) => [...prev, ''])
  const removeMemberRow = (index) => setMemberNames((prev) => prev.filter((_, i) => i !== index))

  const handlePickPhoto = (file) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values, selectedCategory)
    setErrors(nextErrors)
    setTouched({ flatId: true, visitorCategoryId: true, primaryVisitorName: true, primaryMobile: true, vehicleNo: true, companyName: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    let created
    try {
      created = await createVisitor({
        flatId: Number(values.flatId),
        visitorCategoryId: Number(values.visitorCategoryId),
        primaryVisitorName: values.primaryVisitorName.trim(),
        primaryMobile: values.primaryMobile.trim() || undefined,
        vehicleNo: values.vehicleNo.trim() || undefined,
        companyName: values.companyName.trim() || undefined,
        partySize: values.partySize ? Number(values.partySize) : 1,
        purpose: values.purpose.trim() || undefined,
        memberNames: memberNames.map((n) => n.trim()).filter(Boolean),
      })
    } catch (err) {
      setStatus('idle')
      setServerError(err.message)
      if (err.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
      return
    }

    // The visitor is already logged at this point — a photo-upload failure here is surfaced as a
    // non-blocking warning (added from the visitor's detail page instead), not a reason to treat
    // the whole submit as failed.
    let photoWarning = ''
    if (photoFile) {
      try {
        await uploadVisitorPhotos(created.visitorLogId, [photoFile])
      } catch (err) {
        photoWarning = `Visitor logged, but the photo failed to upload: ${err.message}`
      }
    }

    setStatus('idle')
    onCreated?.(created, photoWarning)
  }

  return (
    <SidePanel
      title="Log Visitor"
      subtitle="Record a new visitor entry at the security gate."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="visitor-log-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Logging…' : 'Log Visitor'}
          </button>
        </>
      }
    >
      <form id="visitor-log-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

        <SelectField
          id="flatId"
          label="Flat"
          value={values.flatId}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.flatId ? errors.flatId : undefined}
          disabled={flatsStatus === 'loading'}
          hint={flatsStatus === 'error' ? 'Could not load flats — try again.' : undefined}
        >
          <option value="">{flatsStatus === 'loading' ? 'Loading flats…' : 'Select a flat'}</option>
          {flats.map((flat) => (
            <option key={flat.flatId} value={flat.flatId}>
              {flat.flatNo}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="visitorCategoryId"
          label="Category"
          value={values.visitorCategoryId}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.visitorCategoryId ? errors.visitorCategoryId : undefined}
          disabled={categoriesStatus === 'loading'}
          hint={categoriesStatus === 'error' ? 'Could not load categories — try again.' : undefined}
        >
          <option value="">{categoriesStatus === 'loading' ? 'Loading categories…' : 'Select a category'}</option>
          {categories.map((category) => (
            <option key={category.visitorCategoryId} value={category.visitorCategoryId}>
              {category.categoryName}
            </option>
          ))}
        </SelectField>

        {selectedCategory && (
          <p className="field-hint">
            {selectedCategory.requiresApprovalDefault
              ? 'This category requires resident approval before entry.'
              : 'This category does not require approval — the visitor will be checked in immediately.'}
          </p>
        )}

        <FormField
          id="primaryVisitorName"
          label="Visitor name"
          value={values.primaryVisitorName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.primaryVisitorName ? errors.primaryVisitorName : undefined}
        />

        <FormField
          id="primaryMobile"
          label="Mobile number (optional)"
          type="tel"
          value={values.primaryMobile}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.primaryMobile ? errors.primaryMobile : undefined}
        />

        <FormField
          id="vehicleNo"
          label={`Vehicle number${selectedCategory?.requiresVehicleNo ? '' : ' (optional)'}`}
          value={values.vehicleNo}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.vehicleNo ? errors.vehicleNo : undefined}
        />

        <FormField
          id="companyName"
          label={`Company name${selectedCategory?.requiresCompanyName ? '' : ' (optional)'}`}
          value={values.companyName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.companyName ? errors.companyName : undefined}
        />

        <FormField
          id="partySize"
          label="Party size"
          type="number"
          value={values.partySize}
          onChange={handleChange}
          onBlur={handleBlur}
          hint="Total number of people, including the primary visitor."
        />

        <div className="field">
          <label htmlFor="purpose">Purpose (optional)</label>
          <div className="field-control">
            <textarea id="purpose" name="purpose" rows={3} value={values.purpose} onChange={handleChange} onBlur={handleBlur} />
          </div>
        </div>

        {Number(values.partySize) > 1 && (
          <div className="field">
            <label>Other visitor names (optional)</label>
            {memberNames.map((name, index) => (
              <div key={index} className="field-control" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleMemberChange(index, e.target.value)}
                  placeholder={`Visitor ${index + 2} name`}
                />
                <button type="button" className="table-link-btn danger" onClick={() => removeMemberRow(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="table-secondary-btn" onClick={addMemberRow}>
              + Add name
            </button>
          </div>
        )}

        <PhotoPicker photoFile={photoFile} previewUrl={photoPreviewUrl} onPick={handlePickPhoto} onRemove={handleRemovePhoto} />
      </form>
    </SidePanel>
  )
}
