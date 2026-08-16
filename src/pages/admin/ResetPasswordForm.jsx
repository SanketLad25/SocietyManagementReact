import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import { resetUserPassword } from '../../api/adminUsers.js'
import '../../styles/auth.css'

function validate(values) {
  const errors = {}
  if (!values.newPassword || values.newPassword.length < 8) {
    errors.newPassword = 'Password must be at least 8 characters.'
  }
  if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }
  return errors
}

export default function ResetPasswordForm({ user, onClose, onSaved }) {
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' })
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
    setTouched({ newPassword: true, confirmPassword: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    try {
      await resetUserPassword(user.userId, values.newPassword)
      onSaved()
    } catch (err) {
      setStatus('idle')
      setServerError(err.message)
    }
  }

  return (
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      {serverError && <p className="auth-banner-error">{serverError}</p>}
      <p className="field-hint">
        Setting a new password for <strong>{user.username}</strong>. They'll be asked to change it again on
        their next login.
      </p>

      <FormField
        id="newPassword"
        label="New Password"
        type="password"
        value={values.newPassword}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.newPassword ? errors.newPassword : undefined}
      />

      <FormField
        id="confirmPassword"
        label="Confirm New Password"
        type="password"
        value={values.confirmPassword}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.confirmPassword ? errors.confirmPassword : undefined}
      />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : 'Reset password'}
        </button>
      </div>
    </form>
  )
}
