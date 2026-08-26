import { useEffect, useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { listMaintenanceCategories } from '../../api/maintenanceCategories.js'
import { listCalculationMethods } from '../../api/calculationMethods.js'
import { listChargeTargetTypes } from '../../api/chargeTargetTypes.js'
import { listBillingFrequencies } from '../../api/billingFrequencies.js'
import { listParkingTypes } from '../../api/parkingTypes.js'
import { listAmenities } from '../../api/amenities.js'
import { listFlatGroups } from '../../api/flatGroups.js'
import { listFlats } from '../../api/flats.js'
import { createChargeRule } from '../../api/maintenanceChargeRules.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const PARAMETERS_HINT = {
  SlabTiered: 'JSON slab list, e.g. [{"UpToSqFt":500,"RatePerSqFt":2},{"UpToSqFt":null,"RatePerSqFt":3}]',
  PercentageOfCategory: 'JSON, e.g. {"BaseCategoryId": 5}',
  Formula: 'A formula using Rate and AreaSqFt, e.g. Rate * AreaSqFt * 1.05',
}

export default function ChargeRuleForm({ onClose, onSaved }) {
  const [categories, setCategories] = useState([])
  const [methods, setMethods] = useState([])
  const [targetTypes, setTargetTypes] = useState([])
  const [frequencies, setFrequencies] = useState([])
  const [parkingTypes, setParkingTypes] = useState([])
  const [amenities, setAmenities] = useState([])
  const [flatGroups, setFlatGroups] = useState([])
  const [flats, setFlats] = useState([])

  const [values, setValues] = useState({
    categoryId: '',
    calculationMethodId: '',
    chargeTargetTypeId: '',
    targetId: '',
    rate: '',
    parametersJson: '',
    billingFrequencyId: '',
    effectiveFrom: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    Promise.all([
      listMaintenanceCategories(),
      listCalculationMethods(),
      listChargeTargetTypes(),
      listBillingFrequencies(),
      listParkingTypes(),
      listAmenities(),
      listFlatGroups(),
      listFlats(''),
    ])
      .then(([cats, meths, targets, freqs, parking, amens, groups, flatList]) => {
        setCategories(cats)
        setMethods(meths)
        setTargetTypes(targets.filter((t) => t.isEnabledForSociety))
        setFrequencies(freqs)
        setParkingTypes(parking)
        setAmenities(amens)
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
  const selectedMethod = methods.find((m) => String(m.calculationMethodId) === values.calculationMethodId)

  const targetOptions = () => {
    switch (selectedTargetType?.code) {
      case 'FlatGroup':
        return flatGroups.map((g) => ({ value: g.flatGroupId, label: g.groupName }))
      case 'SpecificFlat':
        return flats.map((f) => ({ value: f.flatId, label: f.flatNo }))
      case 'ParkingType':
        return parkingTypes.map((p) => ({ value: p.parkingTypeId, label: p.typeName }))
      case 'Amenity':
        return amenities.map((a) => ({ value: a.amenityId, label: a.amenityName }))
      default:
        return null
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!values.categoryId || !values.calculationMethodId || !values.chargeTargetTypeId || !values.billingFrequencyId || !values.effectiveFrom) {
      setError('Please fill in all required fields.')
      return
    }

    const needsTarget = selectedTargetType?.code !== 'AllFlats'
    if (needsTarget && !values.targetId) {
      setError('Please select a target for this charge target type.')
      return
    }

    setStatus('submitting')

    const payload = {
      categoryId: Number(values.categoryId),
      calculationMethodId: Number(values.calculationMethodId),
      chargeTargetTypeId: Number(values.chargeTargetTypeId),
      targetId: needsTarget ? Number(values.targetId) : null,
      rate: Number(values.rate) || 0,
      parametersJson: values.parametersJson.trim() || null,
      billingFrequencyId: Number(values.billingFrequencyId),
      effectiveFrom: values.effectiveFrom,
    }

    try {
      await createChargeRule(payload)
      onSaved()
    } catch (err) {
      setStatus('idle')
      setError(err.message)
    }
  }

  const options = status === 'loading' ? null : targetOptions()

  return (
    <SidePanel
      title="Add Charge Rule"
      subtitle="Assign a rate to a category."
      onClose={onClose}
      footer={
        status === 'loading' ? null : (
          <>
            <button type="button" className="table-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="charge-rule-form" className="auth-submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Saving…' : 'Add rule'}
            </button>
          </>
        )
      }
    >
      {status === 'loading' ? (
        <p className="table-empty">Loading form data…</p>
      ) : (
      <form id="charge-rule-form" className="auth-form" onSubmit={handleSubmit} noValidate>
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
        <label htmlFor="calculationMethodId">Calculation method</label>
        <div className="field-control">
          <select id="calculationMethodId" name="calculationMethodId" value={values.calculationMethodId} onChange={handleChange}>
            <option value="">Select a method…</option>
            {methods.map((m) => (
              <option key={m.calculationMethodId} value={m.calculationMethodId}>
                {m.methodName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="chargeTargetTypeId">Applies to</label>
        <div className="field-control">
          <select id="chargeTargetTypeId" name="chargeTargetTypeId" value={values.chargeTargetTypeId} onChange={handleChange}>
            <option value="">Select who this applies to…</option>
            {targetTypes.map((t) => (
              <option key={t.chargeTargetTypeId} value={t.chargeTargetTypeId}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTargetType?.code === 'Wing' && (
        <FormField
          id="targetId"
          label="Wing ID"
          value={values.targetId}
          onChange={handleChange}
          hint="Enter the numeric Wing ID this rule applies to."
        />
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

      <FormField
        id="rate"
        label={selectedMethod?.methodCode === 'PercentageOfCategory' ? 'Percentage' : 'Rate'}
        value={values.rate}
        onChange={handleChange}
        hint={selectedMethod?.methodCode === 'SlabTiered' ? 'Unused for slab-tiered — set rates per slab below.' : undefined}
      />

      {selectedMethod && PARAMETERS_HINT[selectedMethod.methodCode] && (
        <FormField
          id="parametersJson"
          label="Parameters"
          value={values.parametersJson}
          onChange={handleChange}
          hint={PARAMETERS_HINT[selectedMethod.methodCode]}
        />
      )}

      <div className="field">
        <label htmlFor="billingFrequencyId">Billing frequency</label>
        <div className="field-control">
          <select id="billingFrequencyId" name="billingFrequencyId" value={values.billingFrequencyId} onChange={handleChange}>
            <option value="">Select a frequency…</option>
            {frequencies.map((f) => (
              <option key={f.billingFrequencyId} value={f.billingFrequencyId}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FormField id="effectiveFrom" label="Effective from" type="date" value={values.effectiveFrom} onChange={handleChange} />

      </form>
      )}
    </SidePanel>
  )
}
