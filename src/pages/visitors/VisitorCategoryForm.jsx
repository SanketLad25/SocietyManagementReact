import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createVisitorCategory, updateVisitorCategory } from '../../api/visitorCategories.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(category) {
  return {
    categoryName: category?.categoryName || '',
    requiresVehicleNo: category?.requiresVehicleNo ?? false,
    requiresCompanyName: category?.requiresCompanyName ?? false,
    requiresApprovalDefault: category?.requiresApprovalDefault ?? true,
    displayOrder: category?.displayOrder != null ? String(category.displayOrder) : '',
    isActive: category?.isActive ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.categoryName.trim()) {
    errors.categoryName = 'Category name is required.'
  }

  if (values.displayOrder && !/^\d+$/.test(values.displayOrder.trim())) {
    errors.displayOrder = 'Display order must be a number.'
  }

  return errors
}

export default function VisitorCategoryForm({ category, onClose, onSaved }) {
  const isEditMode = Boolean(category)

  const [values, setValues] = useState(() => toInitialValues(category))
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
    setTouched({ categoryName: true, displayOrder: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      categoryName: values.categoryName.trim(),
      requiresVehicleNo: values.requiresVehicleNo,
      requiresCompanyName: values.requiresCompanyName,
      requiresApprovalDefault: values.requiresApprovalDefault,
      displayOrder: values.displayOrder.trim() ? Number(values.displayOrder.trim()) : null,
      isActive: values.isActive,
    }

    try {
      if (isEditMode) {
        await updateVisitorCategory(category.visitorCategoryId, payload)
      } else {
        await createVisitorCategory(payload)
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
      title={isEditMode ? 'Edit Category' : 'Add Category'}
      subtitle={isEditMode ? 'Update this visitor category.' : 'Add a new visitor category.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="visitor-category-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add category'}
          </button>
        </>
      }
    >
      <form id="visitor-category-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="categoryName"
        label="Category Name"
        placeholder="e.g. Guest"
        value={values.categoryName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.categoryName ? errors.categoryName : undefined}
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
          <input name="requiresApprovalDefault" type="checkbox" checked={values.requiresApprovalDefault} onChange={handleChange} />
          Requires resident approval before entry
        </label>
      </div>

      <div className="field">
        <label className="auth-checkbox">
          <input name="requiresVehicleNo" type="checkbox" checked={values.requiresVehicleNo} onChange={handleChange} />
          Requires a vehicle number
        </label>
      </div>

      <div className="field">
        <label className="auth-checkbox">
          <input name="requiresCompanyName" type="checkbox" checked={values.requiresCompanyName} onChange={handleChange} />
          Requires a company name
        </label>
      </div>

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
