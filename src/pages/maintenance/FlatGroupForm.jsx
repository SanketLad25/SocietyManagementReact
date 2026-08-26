import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createFlatGroup, updateFlatGroup } from '../../api/flatGroups.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(group) {
  return {
    groupName: group?.groupName || '',
    description: group?.description || '',
    isActive: group?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.groupName.trim()) {
    errors.groupName = 'Group name is required.'
  }

  return errors
}

export default function FlatGroupForm({ group, onClose, onSaved }) {
  const isEditMode = Boolean(group)

  const [values, setValues] = useState(() => toInitialValues(group))
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
    setTouched({ groupName: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      groupName: values.groupName.trim(),
      description: values.description.trim() || null,
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateFlatGroup(group.flatGroupId, payload)
      } else {
        await createFlatGroup(payload)
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
      title={isEditMode ? 'Edit Flat Group' : 'Add Flat Group'}
      subtitle={isEditMode ? 'Update this flat group.' : 'Add a new flat group.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="flat-group-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add group'}
          </button>
        </>
      }
    >
      <form id="flat-group-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="groupName"
        label="Group Name"
        placeholder="e.g. Wing A Owners"
        value={values.groupName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.groupName ? errors.groupName : undefined}
      />

      <FormField
        id="description"
        label="Description (optional)"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
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
