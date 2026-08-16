import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../../api/session.js'
import { listMaintenanceCategories } from '../../api/maintenanceCategories.js'
import { listBillingFrequencies } from '../../api/billingFrequencies.js'
import { listParkingTypes } from '../../api/parkingTypes.js'
import { listAmenities } from '../../api/amenities.js'
import { listFlatGroups } from '../../api/flatGroups.js'
import { listChargeRules } from '../../api/maintenanceChargeRules.js'
import { listExemptions } from '../../api/maintenanceExemptions.js'
import { listChargeTargetTypes, setChargeTargetTypeEnablement } from '../../api/chargeTargetTypes.js'
import MyCharges from './MyCharges.jsx'
import '../../styles/dataTable.css'

const CHECKLIST_ITEMS = [
  { key: 'categories', label: 'Maintenance Categories', path: '/dashboard/maintenance/categories' },
  { key: 'billingFrequencies', label: 'Billing Frequencies', path: '/dashboard/maintenance/billing-frequencies' },
  { key: 'parkingTypes', label: 'Parking Types', path: '/dashboard/maintenance/parking-types', optional: true },
  { key: 'amenities', label: 'Amenities', path: '/dashboard/maintenance/amenities', optional: true },
  { key: 'flatGroups', label: 'Flat Groups', path: '/dashboard/maintenance/flat-groups', optional: true },
  { key: 'chargeRules', label: 'Charge Rules', path: '/dashboard/maintenance/charge-rules' },
  { key: 'exemptions', label: 'Exemptions', path: '/dashboard/maintenance/exemptions', optional: true },
]

export default function MaintenanceHub() {
  const session = getSession()
  const role = session?.role
  const isAdmin = role === 'Admin'

  const [counts, setCounts] = useState(null)
  const [targetTypes, setTargetTypes] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const [categories, billingFrequencies, parkingTypes, amenities, flatGroups, chargeRules, exemptions, chargeTargetTypes] =
        await Promise.all([
          listMaintenanceCategories(),
          listBillingFrequencies(),
          listParkingTypes(),
          listAmenities(),
          listFlatGroups(),
          listChargeRules(),
          listExemptions(),
          listChargeTargetTypes(),
        ])
      setCounts({
        categories: categories.length,
        billingFrequencies: billingFrequencies.length,
        parkingTypes: parkingTypes.length,
        amenities: amenities.length,
        flatGroups: flatGroups.length,
        chargeRules: chargeRules.length,
        exemptions: exemptions.length,
      })
      setTargetTypes(chargeTargetTypes)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    if (role !== 'Resident') {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  if (role === 'Resident') {
    return <MyCharges />
  }

  const handleToggle = async (targetType) => {
    setTogglingId(targetType.chargeTargetTypeId)
    setError('')
    try {
      await setChargeTargetTypeEnablement(targetType.chargeTargetTypeId, !targetType.isEnabledForSociety)
      setTargetTypes((prev) =>
        prev.map((t) =>
          t.chargeTargetTypeId === targetType.chargeTargetTypeId
            ? { ...t, isEnabledForSociety: !t.isEnabledForSociety }
            : t,
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Maintenance Setup</h2>
          <p>Configure how your society bills for maintenance — categories, charges, parking, and amenities.</p>
        </div>
        <Link className="table-primary-btn" to="/dashboard/maintenance/billing-cycles">
          Billing Cycles
        </Link>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading maintenance setup…</p>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Setup step</th>
                  <th>Status</th>
                  {isAdmin && <th className="table-actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {CHECKLIST_ITEMS.map((item) => {
                  const count = counts?.[item.key] ?? 0
                  const done = count > 0
                  return (
                    <tr key={item.key}>
                      <td>
                        {item.label}
                        {item.optional && <span className="table-hint"> (optional)</span>}
                      </td>
                      <td>
                        <span className={`table-badge ${done ? 'badge-success' : 'badge-neutral'}`}>
                          {done ? `${count} configured` : 'Not configured yet'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="table-actions-col">
                          <Link className="table-link-btn" to={item.path}>
                            Manage
                          </Link>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="table-section-title">Charge target types</h3>
          <p className="table-section-subtitle">
            Turn off any targeting option your society never uses — it simplifies the charge-rule form later.
          </p>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target type</th>
                  <th>Status</th>
                  {isAdmin && <th className="table-actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {targetTypes.map((targetType) => (
                  <tr key={targetType.chargeTargetTypeId}>
                    <td>{targetType.label}</td>
                    <td>
                      <span
                        className={`table-badge ${targetType.isEnabledForSociety ? 'badge-success' : 'badge-muted'}`}
                      >
                        {targetType.isEnabledForSociety ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="table-actions-col">
                        <button
                          type="button"
                          className="table-link-btn"
                          disabled={togglingId === targetType.chargeTargetTypeId}
                          onClick={() => handleToggle(targetType)}
                        >
                          {targetType.isEnabledForSociety ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
