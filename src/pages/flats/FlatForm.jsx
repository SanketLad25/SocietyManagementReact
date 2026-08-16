import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import { createFlat, updateFlat } from '../../api/flats.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(flat) {
  return {
    flatNo: flat?.flatNo || '',
    wingId: flat?.wingId != null ? String(flat.wingId) : '',
    floorNo: flat?.floorNo != null ? String(flat.floorNo) : '',
    areaSqFt: flat?.areaSqFt != null ? String(flat.areaSqFt) : '',
    maintenanceAmount: flat?.maintenanceAmount != null ? String(flat.maintenanceAmount) : '',
  }
}

function validate(values) {
  const errors = {}

  if (!values.flatNo.trim()) {
    errors.flatNo = 'Flat No is required.'
  }

  if (values.wingId && !/^\d+$/.test(values.wingId.trim())) {
    errors.wingId = 'Wing ID must be a number.'
  }

  if (values.floorNo && !/^-?\d+$/.test(values.floorNo.trim())) {
    errors.floorNo = 'Floor No must be a number.'
  }

  if (values.areaSqFt && Number.isNaN(Number(values.areaSqFt))) {
    errors.areaSqFt = 'Area must be a number.'
  }

  if (values.maintenanceAmount && Number.isNaN(Number(values.maintenanceAmount))) {
    errors.maintenanceAmount = 'Maintenance amount must be a number.'
  }

  return errors
}

export default function FlatForm({ flat, onClose, onSaved }) {
  const isEditMode = Boolean(flat)

  const [values, setValues] = useState(() => toInitialValues(flat))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

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
    setTouched({ flatNo: true, wingId: true, floorNo: true, areaSqFt: true, maintenanceAmount: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      flatNo: values.flatNo.trim(),
      wingId: values.wingId.trim() ? Number(values.wingId.trim()) : null,
      floorNo: values.floorNo.trim() ? Number(values.floorNo.trim()) : null,
      areaSqFt: values.areaSqFt.trim() ? Number(values.areaSqFt.trim()) : null,
      maintenanceAmount: values.maintenanceAmount.trim() ? Number(values.maintenanceAmount.trim()) : null,
    }

    try {
      if (isEditMode) {
        await updateFlat(flat.flatId, payload)
      } else {
        await createFlat(payload)
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
        id="flatNo"
        label="Flat No"
        placeholder="e.g. A-101"
        value={values.flatNo}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.flatNo ? errors.flatNo : undefined}
      />

      <FormField
        id="wingId"
        label="Wing ID (optional)"
        placeholder="Leave blank if not yet assigned"
        value={values.wingId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.wingId ? errors.wingId : undefined}
      />

      <FormField
        id="floorNo"
        label="Floor No (optional)"
        value={values.floorNo}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.floorNo ? errors.floorNo : undefined}
      />

      <FormField
        id="areaSqFt"
        label="Area, sq ft (optional)"
        value={values.areaSqFt}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.areaSqFt ? errors.areaSqFt : undefined}
      />

      <FormField
        id="maintenanceAmount"
        label="Maintenance amount (optional)"
        value={values.maintenanceAmount}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.maintenanceAmount ? errors.maintenanceAmount : undefined}
      />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add flat'}
        </button>
      </div>
    </form>
  )
}
