import { useEffect, useState } from 'react'
import FormField, { SelectField } from '../../components/FormField.jsx'
import { createResident, updateResident } from '../../api/residents.js'
import { listFlats } from '../../api/flats.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_PATTERN = /^[6-9]\d{9}$/

function toInitialValues(resident) {
  return {
    fullName: resident?.fullName || '',
    email: resident?.email || '',
    mobile: resident?.mobile || '',
    flatId: resident?.flatId != null ? String(resident.flatId) : '',
    isOwner: resident?.isOwner ?? false,
    isActive: resident?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.mobile.trim()) {
    errors.mobile = 'Mobile number is required.'
  } else if (!MOBILE_PATTERN.test(values.mobile.trim())) {
    errors.mobile = 'Enter a valid 10-digit mobile number.'
  }

  return errors
}

export default function ResidentForm({ resident, onClose, onSaved }) {
  const isEditMode = Boolean(resident)

  const [values, setValues] = useState(() => toInitialValues(resident))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')
  const [flats, setFlats] = useState([])
  const [flatsStatus, setFlatsStatus] = useState('loading')

  useEffect(() => {
    listFlats()
      .then((data) => {
        setFlats(data)
        setFlatsStatus('idle')
      })
      .catch(() => setFlatsStatus('error'))
  }, [])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    const nextValues = { ...values, [name]: nextValue }
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
    setTouched({ fullName: true, email: true, mobile: true, flatId: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      mobile: values.mobile.trim(),
      flatId: values.flatId.trim() ? Number(values.flatId.trim()) : null,
      isOwner: values.isOwner,
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateResident(resident.residentId, payload)
      } else {
        await createResident(payload)
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

  return (
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="fullName"
        label="Full name"
        value={values.fullName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.fullName ? errors.fullName : undefined}
      />

      <FormField
        id="email"
        label="Email address"
        type="email"
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.email ? errors.email : undefined}
      />

      <FormField
        id="mobile"
        label="Mobile number"
        type="tel"
        value={values.mobile}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.mobile ? errors.mobile : undefined}
      />

      <SelectField
        id="flatId"
        label="Flat (optional)"
        value={values.flatId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.flatId ? errors.flatId : undefined}
        disabled={flatsStatus === 'loading'}
        hint={flatsStatus === 'error' ? 'Could not load flats — leave blank or try again.' : undefined}
      >
        <option value="">
          {flatsStatus === 'loading' ? 'Loading flats…' : 'Not yet assigned'}
        </option>
        {flats.map((flat) => (
          <option key={flat.flatId} value={flat.flatId}>
            {flat.flatNo}
          </option>
        ))}
      </SelectField>

      <div className="field">
        <label className="auth-checkbox">
          <input type="checkbox" name="isOwner" checked={values.isOwner} onChange={handleChange} />
          Registered owner (uncheck if tenant)
        </label>
      </div>

      <div className="field">
        <label className="auth-checkbox">
          <input type="checkbox" name="isActive" checked={values.isActive} onChange={handleChange} />
          Active resident
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add resident'}
        </button>
      </div>
    </form>
  )
}
