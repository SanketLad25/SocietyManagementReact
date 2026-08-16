import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import { createBillingCycle } from '../../api/maintenanceBilling.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

export default function BillingCycleForm({ onClose, onSaved }) {
  const [values, setValues] = useState({ cycleLabel: '', periodStart: '', periodEnd: '', dueDate: '' })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!values.cycleLabel.trim() || !values.periodStart || !values.periodEnd || !values.dueDate) {
      setError('Please fill in all fields.')
      return
    }

    setStatus('submitting')

    try {
      await createBillingCycle({
        cycleLabel: values.cycleLabel.trim(),
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        dueDate: values.dueDate,
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

      <FormField id="cycleLabel" label="Cycle label" placeholder="e.g. September 2026" value={values.cycleLabel} onChange={handleChange} />
      <FormField id="periodStart" label="Period start" type="date" value={values.periodStart} onChange={handleChange} />
      <FormField id="periodEnd" label="Period end" type="date" value={values.periodEnd} onChange={handleChange} />
      <FormField id="dueDate" label="Due date" type="date" value={values.dueDate} onChange={handleChange} />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : 'Create cycle'}
        </button>
      </div>
    </form>
  )
}
