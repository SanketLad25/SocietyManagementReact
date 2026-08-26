import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createUser, updateUser } from '../../api/adminUsers.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const ASSIGNABLE_ROLES = ['Admin', 'Chairman', 'Secretary', 'Treasurer', 'Resident', 'Security']

function toInitialValues(user) {
  return {
    username: user?.username || '',
    password: '',
    confirmPassword: '',
    roleName: user?.roleName || 'Resident',
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    isActive: user ? user.isActive : true,
  }
}

function validate(values, isEditMode) {
  const errors = {}

  if (!isEditMode) {
    if (!values.username.trim()) {
      errors.username = 'Username is required.'
    }
    if (!values.password || values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }
    if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match.'
    }
    if (values.roleName === 'Resident' && !values.fullName.trim()) {
      errors.fullName = 'Full name is required for a resident account.'
    }
  }

  return errors
}

export default function UserForm({ user, onClose, onSaved }) {
  const isEditMode = Boolean(user)

  const [values, setValues] = useState(() => toInitialValues(user))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValues = { ...values, [name]: type === 'checkbox' ? checked : value }
    setValues(nextValues)
    if (touched[name]) {
      setErrors(validate(nextValues, isEditMode))
    }
  }

  const handleBlur = (event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(values, isEditMode))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values, isEditMode)
    setErrors(nextErrors)
    setTouched({ username: true, password: true, confirmPassword: true, fullName: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    try {
      if (isEditMode) {
        await updateUser(user.userId, {
          roleName: values.roleName,
          isActive: values.isActive,
          fullName: values.fullName.trim() || undefined,
          email: values.email.trim() || undefined,
          mobile: values.mobile.trim() || undefined,
        })
      } else {
        await createUser({
          username: values.username.trim(),
          password: values.password,
          roleName: values.roleName,
          fullName: values.fullName.trim() || undefined,
          email: values.email.trim() || undefined,
          mobile: values.mobile.trim() || undefined,
        })
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

  const isResidentLinked = isEditMode ? Boolean(user.residentId) : values.roleName === 'Resident'

  return (
    <SidePanel
      title={isEditMode ? 'Edit User' : 'Add User'}
      subtitle={
        isEditMode
          ? "Update this user's details, role, and active status."
          : 'Create a login for someone in your society and assign their role.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Create user'}
          </button>
        </>
      }
    >
      <form id="user-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="username"
        label="Username"
        value={values.username}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.username ? errors.username : undefined}
        disabled={isEditMode}
        hint={isEditMode ? 'Username cannot be changed after creation.' : undefined}
      />

      {!isEditMode && (
        <>
          <FormField
            id="password"
            label="Password"
            type="password"
            value={values.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.password ? errors.password : undefined}
            hint="Share this with the user directly — they'll be asked to change it on first login."
          />

          <FormField
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            value={values.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.confirmPassword ? errors.confirmPassword : undefined}
          />
        </>
      )}

      <div className="field">
        <label htmlFor="roleName">Role</label>
        <div className="field-control">
          <select id="roleName" name="roleName" value={values.roleName} onChange={handleChange}>
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(!isEditMode ? values.roleName === 'Resident' : isResidentLinked) && (
        <>
          <FormField
            id="fullName"
            label="Full name"
            value={values.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.fullName ? errors.fullName : undefined}
          />

          <FormField
            id="email"
            label="Email address (optional)"
            type="email"
            value={values.email}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          <FormField
            id="mobile"
            label="Mobile number (optional)"
            type="tel"
            value={values.mobile}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </>
      )}

      {isEditMode && (
        <div className="field">
          <label className="auth-checkbox">
            <input type="checkbox" name="isActive" checked={values.isActive} onChange={handleChange} />
            Active (unchecking prevents this user from logging in)
          </label>
        </div>
      )}

      </form>
    </SidePanel>
  )
}
