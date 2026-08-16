import { useEffect, useState } from 'react'
import FormField, { SelectField } from '../../components/FormField.jsx'
import { createParking, updateParking } from '../../api/parking.js'
import { listFlats } from '../../api/flats.js'
import { listParkingTypes } from '../../api/parkingTypes.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(parking) {
  return {
    flatId: parking?.flatId != null ? String(parking.flatId) : '',
    parkingTypeId: parking?.parkingTypeId != null ? String(parking.parkingTypeId) : '',
    parkingNo: parking?.parkingNo || '',
    vehicleNo: parking?.vehicleNo || '',
    vehicleType: parking?.vehicleType || '',
  }
}

function validate(values) {
  const errors = {}

  if (!values.flatId) {
    errors.flatId = 'Flat is required.'
  }

  if (!values.parkingTypeId) {
    errors.parkingTypeId = 'Parking type is required.'
  }

  return errors
}

export default function ParkingForm({ parking, onClose, onSaved }) {
  const isEditMode = Boolean(parking)

  const [values, setValues] = useState(() => toInitialValues(parking))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const [flats, setFlats] = useState([])
  const [flatsStatus, setFlatsStatus] = useState('loading')
  const [parkingTypes, setParkingTypes] = useState([])
  const [parkingTypesStatus, setParkingTypesStatus] = useState('loading')

  useEffect(() => {
    listFlats()
      .then((data) => {
        setFlats(data)
        setFlatsStatus('idle')
      })
      .catch(() => setFlatsStatus('error'))

    listParkingTypes()
      .then((data) => {
        setParkingTypes(data.filter((t) => t.isActive))
        setParkingTypesStatus('idle')
      })
      .catch(() => setParkingTypesStatus('error'))
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
    setTouched({ flatId: true, parkingTypeId: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      flatId: Number(values.flatId),
      parkingTypeId: Number(values.parkingTypeId),
      parkingNo: values.parkingNo.trim() || undefined,
      vehicleNo: values.vehicleNo.trim() || undefined,
      vehicleType: values.vehicleType.trim() || undefined,
    }

    try {
      if (isEditMode) {
        await updateParking(parking.parkingId, payload)
      } else {
        await createParking(payload)
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
        id="parkingTypeId"
        label="Parking Type"
        value={values.parkingTypeId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.parkingTypeId ? errors.parkingTypeId : undefined}
        disabled={parkingTypesStatus === 'loading'}
        hint={
          parkingTypesStatus === 'error'
            ? 'Could not load parking types — try again.'
            : parkingTypes.length === 0 && parkingTypesStatus === 'idle'
              ? 'No parking types configured yet — add one under Maintenance → Parking Types.'
              : 'This is the billing category (e.g. Two-Wheeler, Four-Wheeler) this slot counts against.'
        }
      >
        <option value="">{parkingTypesStatus === 'loading' ? 'Loading parking types…' : 'Select a parking type'}</option>
        {parkingTypes.map((type) => (
          <option key={type.parkingTypeId} value={type.parkingTypeId}>
            {type.typeName}
          </option>
        ))}
      </SelectField>

      <FormField
        id="parkingNo"
        label="Parking Slot No (optional)"
        placeholder="e.g. P-12"
        value={values.parkingNo}
        onChange={handleChange}
        onBlur={handleBlur}
      />

      <FormField
        id="vehicleNo"
        label="Vehicle No (optional)"
        placeholder="e.g. MH02AB1234"
        value={values.vehicleNo}
        onChange={handleChange}
        onBlur={handleBlur}
      />

      <FormField
        id="vehicleType"
        label="Vehicle Type (optional)"
        placeholder="e.g. Scooter, Sedan"
        value={values.vehicleType}
        onChange={handleChange}
        onBlur={handleBlur}
      />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add parking'}
        </button>
      </div>
    </form>
  )
}
