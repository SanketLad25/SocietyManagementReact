import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createAmenity, updateAmenity } from '../../api/amenities.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(amenity) {
  return {
    amenityName: amenity?.amenityName || '',
    description: amenity?.description || '',
    requiresOptIn: amenity?.requiresOptIn ?? false,
    displayOrder: amenity?.displayOrder != null ? String(amenity.displayOrder) : '',
    isActive: amenity?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.amenityName.trim()) {
    errors.amenityName = 'Amenity name is required.'
  }

  if (values.displayOrder && !/^\d+$/.test(values.displayOrder.trim())) {
    errors.displayOrder = 'Display order must be a number.'
  }

  return errors
}

export default function AmenityForm({ amenity, onClose, onSaved }) {
  const isEditMode = Boolean(amenity)

  const [values, setValues] = useState(() => toInitialValues(amenity))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValues = { ...values, [name]: type === 'checkbox' ? checked : value }
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
    setTouched({ amenityName: true, displayOrder: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      amenityName: values.amenityName.trim(),
      description: values.description.trim() || null,
      requiresOptIn: values.requiresOptIn,
      displayOrder: values.displayOrder.trim() ? Number(values.displayOrder.trim()) : null,
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateAmenity(amenity.amenityId, payload)
      } else {
        await createAmenity(payload)
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
    <SidePanel
      title={isEditMode ? 'Edit Amenity' : 'Add Amenity'}
      subtitle={isEditMode ? 'Update this amenity.' : 'Add a new amenity.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="amenity-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add amenity'}
          </button>
        </>
      }
    >
      <form id="amenity-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="amenityName"
        label="Amenity Name"
        placeholder="e.g. Gym"
        value={values.amenityName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.amenityName ? errors.amenityName : undefined}
      />

      <FormField
        id="description"
        label="Description (optional)"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
      />

      <FormField
        id="displayOrder"
        label="Display order (optional)"
        value={values.displayOrder}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.displayOrder ? errors.displayOrder : undefined}
      />

      <div className="field">
        <label className="auth-checkbox">
          <input name="requiresOptIn" type="checkbox" checked={values.requiresOptIn} onChange={handleChange} />
          Requires opt-in (residents subscribe individually, e.g. gym or clubhouse)
        </label>
      </div>

      <div className="field">
        <label className="auth-checkbox">
          <input name="isActive" type="checkbox" checked={values.isActive} onChange={handleChange} />
          Active
        </label>
      </div>

      </form>
    </SidePanel>
  )
}
