import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import PasswordToggle from '../components/PasswordToggle.jsx'
import { loginResident } from '../api/client.js'
import { saveSession } from '../api/session.js'
import '../styles/auth.css'

function validate(values) {
  const errors = {}

  if (!values.username.trim()) {
    errors.username = 'Username is required.'
  }

  if (!values.password) {
    errors.password = 'Password is required.'
  }

  return errors
}

export default function Login() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ societyName: '', username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [serverError, setServerError] = useState('')
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 700)
    return () => clearTimeout(timer)
  }, [status, navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      setErrors(validate({ ...values, [name]: value }))
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
    setTouched({ societyName: true, username: true, password: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    try {
      const response = await loginResident({
        societyName: values.societyName.trim(),
        username: values.username.trim(),
        password: values.password,
      })
      saveSession(response)
      setSession(response)
      setStatus('success')
    } catch (error) {
      setStatus('idle')
      setServerError(error.message)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to access your society management account.">
      {status === 'success' ? (
        <div className="auth-success" role="status">
          <span className="auth-success-icon" aria-hidden="true">
            ✓
          </span>
          <h3>Signed in successfully</h3>
          <p>
            Welcome back, {session?.fullName || session?.email || 'there'}.{' '}
            {session?.mustChangePassword
              ? 'You need to set a new password before continuing…'
              : 'Redirecting to your dashboard…'}
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {serverError && <p className="auth-banner-error">{serverError}</p>}

          <FormField
            id="societyName"
            label="Society name"
            placeholder="e.g. Shubhangi CHSL"
            autoComplete="organization"
            value={values.societyName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.societyName ? errors.societyName : undefined}
            hint="Leave blank if you're a platform administrator."
          />

          <FormField
            id="username"
            label="Username"
            placeholder="Your username"
            autoComplete="username"
            value={values.username}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.username ? errors.username : undefined}
          />

          <FormField
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.password ? errors.password : undefined}
            rightSlot={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
                controlsId="password"
              />
            }
          />

          <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
