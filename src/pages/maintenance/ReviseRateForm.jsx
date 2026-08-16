import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import { reviseChargeRule } from '../../api/maintenanceChargeRules.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

export default function ReviseRateForm({ rule, onClose, onSaved }) {
  const [values, setValues] = useState({
    rate: String(rule.rate),
    parametersJson: rule.parametersJson || '',
    effectiveFrom: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!values.effectiveFrom) {
      setError('Please choose the date the new rate takes effect.')
      return
    }

    setStatus('submitting')

    try {
      await reviseChargeRule(rule.ruleId, {
        rate: Number(values.rate) || 0,
        parametersJson: values.parametersJson.trim() || null,
        effectiveFrom: values.effectiveFrom,
      })
      onSaved()
    } catch (err) {
      setStatus('idle')
      setError(err.message)
    }
  }

  return (
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      {error && <p className="auth-banner-error">{error}</p>}

      <p className="table-hint">
        Current rate {rule.rate} runs from {rule.effectiveFrom}. Revising closes that rule on the day before your new
        effective date and starts a new one — past bills stay computed at the old rate.
      </p>

      <FormField id="rate" label="New rate" value={values.rate} onChange={handleChange} />

      <FormField id="parametersJson" label="Parameters (optional)" value={values.parametersJson} onChange={handleChange} />

      <FormField id="effectiveFrom" label="New rate effective from" type="date" value={values.effectiveFrom} onChange={handleChange} />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : 'Revise rate'}
        </button>
      </div>
    </form>
  )
}
