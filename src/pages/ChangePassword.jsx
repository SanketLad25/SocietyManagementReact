import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { changePassword } from '../api/client.js'
import { getSession, saveSession } from '../api/session.js'

function validate(values) {
  const errors = {}
  if (!values.currentPassword) {
    errors.currentPassword = 'Old password is required.'
  }
  if (!values.newPassword || values.newPassword.length < 8) {
    errors.newPassword = 'New password must be at least 8 characters.'
  }
  if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }
  return errors
}

export default function ChangePassword() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState('')

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
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      const session = getSession()
      if (session) {
        saveSession({ ...session, mustChangePassword: false })
      }

      navigate('/dashboard', { replace: true })
    } catch (error) {
      setStatus('idle')
      setServerError(error.message)
    }
  }

  return (
    <AuthLayout
      title="Change your password"
      subtitle="For security, you need to set a new password before continuing."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

        <FormField
          id="currentPassword"
          label="Old Password"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.currentPassword ? errors.currentPassword : undefined}
        />

        <FormField
          id="newPassword"
          label="New Password"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.newPassword ? errors.newPassword : undefined}
        />

        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.confirmPassword ? errors.confirmPassword : undefined}
        />

        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </AuthLayout>
  )
}
