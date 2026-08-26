import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createParkingType, updateParkingType } from '../../api/parkingTypes.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(parkingType) {
  return {
    typeName: parkingType?.typeName || '',
    displayOrder: parkingType?.displayOrder != null ? String(parkingType.displayOrder) : '',
    isActive: parkingType?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.typeName.trim()) {
    errors.typeName = 'Type name is required.'
  }

  if (values.displayOrder && !/^\d+$/.test(values.displayOrder.trim())) {
    errors.displayOrder = 'Display order must be a number.'
  }

  return errors
}

export default function ParkingTypeForm({ parkingType, onClose, onSaved }) {
  const isEditMode = Boolean(parkingType)

  const [values, setValues] = useState(() => toInitialValues(parkingType))
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
    setTouched({ typeName: true, displayOrder: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      typeName: values.typeName.trim(),
      displayOrder: values.displayOrder.trim() ? Number(values.displayOrder.trim()) : null,
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateParkingType(parkingType.parkingTypeId, payload)
      } else {
        await createParkingType(payload)
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
      title={isEditMode ? 'Edit Parking Type' : 'Add Parking Type'}
      subtitle={isEditMode ? 'Update this parking type.' : 'Add a new parking type.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="parking-type-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add parking type'}
          </button>
        </>
      }
    >
      <form id="parking-type-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="typeName"
        label="Type Name"
        placeholder="e.g. Two-Wheeler"
        value={values.typeName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.typeName ? errors.typeName : undefined}
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
          <input name="isActive" type="checkbox" checked={values.isActive} onChange={handleChange} />
          Active
        </label>
      </div>

      </form>
    </SidePanel>
  )
}
