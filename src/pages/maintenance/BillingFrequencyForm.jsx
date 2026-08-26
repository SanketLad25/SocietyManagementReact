import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createBillingFrequency, updateBillingFrequency } from '../../api/billingFrequencies.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(frequency) {
  return {
    label: frequency?.label || '',
    intervalMonths: frequency ? String(frequency.intervalMonths) : '1',
    isActive: frequency?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.label.trim()) {
    errors.label = 'Label is required.'
  }

  if (!/^\d+$/.test(values.intervalMonths.trim())) {
    errors.intervalMonths = 'Interval must be a whole number of months (0 for one-time).'
  }

  return errors
}

export default function BillingFrequencyForm({ frequency, onClose, onSaved }) {
  const isEditMode = Boolean(frequency)

  const [values, setValues] = useState(() => toInitialValues(frequency))
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
    setTouched({ label: true, intervalMonths: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      label: values.label.trim(),
      intervalMonths: Number(values.intervalMonths.trim()),
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateBillingFrequency(frequency.billingFrequencyId, payload)
      } else {
        await createBillingFrequency(payload)
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
      title={isEditMode ? 'Edit Billing Frequency' : 'Add Billing Frequency'}
      subtitle={isEditMode ? 'Update this billing frequency.' : 'Add a new billing frequency.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="billing-frequency-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add frequency'}
          </button>
        </>
      }
    >
      <form id="billing-frequency-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="label"
        label="Label"
        placeholder="e.g. Monthly"
        value={values.label}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.label ? errors.label : undefined}
      />

      <FormField
        id="intervalMonths"
        label="Interval, in months (0 = one-time)"
        value={values.intervalMonths}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.intervalMonths ? errors.intervalMonths : undefined}
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
