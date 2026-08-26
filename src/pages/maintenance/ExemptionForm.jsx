import { useEffect, useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { listMaintenanceCategories } from '../../api/maintenanceCategories.js'
import { listChargeTargetTypes } from '../../api/chargeTargetTypes.js'
import { listFlatGroups } from '../../api/flatGroups.js'
import { listFlats } from '../../api/flats.js'
import { createExemption, updateExemption } from '../../api/maintenanceExemptions.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const ALLOWED_TARGET_CODES = ['AllFlats', 'Wing', 'FlatGroup', 'SpecificFlat']

function toInitialValues(exemption) {
  return {
    categoryId: exemption?.categoryId ? String(exemption.categoryId) : '',
    chargeTargetTypeId: exemption?.chargeTargetTypeId ? String(exemption.chargeTargetTypeId) : '',
    targetId: exemption?.targetId != null ? String(exemption.targetId) : '',
    reason: exemption?.reason || '',
    effectiveFrom: exemption?.effectiveFrom || '',
    effectiveTo: exemption?.effectiveTo || '',
  }
}

export default function ExemptionForm({ exemption, onClose, onSaved }) {
  const isEditMode = Boolean(exemption)

  const [categories, setCategories] = useState([])
  const [targetTypes, setTargetTypes] = useState([])
  const [flatGroups, setFlatGroups] = useState([])
  const [flats, setFlats] = useState([])
  const [values, setValues] = useState(() => toInitialValues(exemption))
  const [error, setError] = useState('')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    Promise.all([listMaintenanceCategories(), listChargeTargetTypes(), listFlatGroups(), listFlats('')])
      .then(([cats, targets, groups, flatList]) => {
        setCategories(cats)
        setTargetTypes(targets.filter((t) => t.isEnabledForSociety && ALLOWED_TARGET_CODES.includes(t.code)))
        setFlatGroups(groups)
        setFlats(flatList)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value, ...(name === 'chargeTargetTypeId' ? { targetId: '' } : {}) }))
  }

  const selectedTargetType = targetTypes.find((t) => String(t.chargeTargetTypeId) === values.chargeTargetTypeId)

  const targetOptions = () => {
    switch (selectedTargetType?.code) {
      case 'FlatGroup':
        return flatGroups.map((g) => ({ value: g.flatGroupId, label: g.groupName }))
      case 'SpecificFlat':
        return flats.map((f) => ({ value: f.flatId, label: f.flatNo }))
      default:
        return null
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!values.categoryId || !values.chargeTargetTypeId || !values.effectiveFrom) {
      setError('Please fill in all required fields.')
      return
    }

    const needsTarget = selectedTargetType?.code !== 'AllFlats'
    if (needsTarget && !values.targetId && selectedTargetType?.code !== 'Wing') {
      setError('Please select a target for this target type.')
      return
    }

    setStatus('submitting')

    const payload = {
      categoryId: Number(values.categoryId),
      chargeTargetTypeId: Number(values.chargeTargetTypeId),
      targetId: needsTarget && values.targetId ? Number(values.targetId) : null,
      reason: values.reason.trim() || null,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || null,
    }

    try {
      if (isEditMode) {
        await updateExemption(exemption.exemptionId, payload)
      } else {
        await createExemption(payload)
      }
      onSaved()
    } catch (err) {
      setStatus('idle')
      setError(err.message)
    }
  }

  const options = status === 'loading' ? null : targetOptions()

  return (
    <SidePanel
      title={isEditMode ? 'Edit Exemption' : 'Add Exemption'}
      subtitle={isEditMode ? 'Update this exemption.' : 'Add a new exemption.'}
      onClose={onClose}
      footer={
        status === 'loading' ? null : (
          <>
            <button type="button" className="table-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="exemption-form" className="auth-submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add exemption'}
            </button>
          </>
        )
      }
    >
      {status === 'loading' ? (
        <p className="table-empty">Loading form data…</p>
      ) : (
      <form id="exemption-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="auth-banner-error">{error}</p>}

      <div className="field">
        <label htmlFor="categoryId">Category</label>
        <div className="field-control">
          <select id="categoryId" name="categoryId" value={values.categoryId} onChange={handleChange}>
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="chargeTargetTypeId">Applies to</label>
        <div className="field-control">
          <select id="chargeTargetTypeId" name="chargeTargetTypeId" value={values.chargeTargetTypeId} onChange={handleChange}>
            <option value="">Select who is exempt…</option>
            {targetTypes.map((t) => (
              <option key={t.chargeTargetTypeId} value={t.chargeTargetTypeId}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTargetType?.code === 'Wing' && (
        <FormField id="targetId" label="Wing ID" value={values.targetId} onChange={handleChange} />
      )}

      {options && (
        <div className="field">
          <label htmlFor="targetId">Select target</label>
          <div className="field-control">
            <select id="targetId" name="targetId" value={values.targetId} onChange={handleChange}>
              <option value="">Select…</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <FormField id="reason" label="Reason (optional)" value={values.reason} onChange={handleChange} />

      <FormField id="effectiveFrom" label="Effective from" type="date" value={values.effectiveFrom} onChange={handleChange} />

      <FormField id="effectiveTo" label="Effective to (optional)" type="date" value={values.effectiveTo} onChange={handleChange} />

      </form>
      )}
    </SidePanel>
  )
}
