import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyCharges } from '../../api/maintenanceChargeRules.js'
import '../../styles/dataTable.css'

function describe(charge) {
  const basis =
    charge.calculationMethodName === 'Fixed amount'
      ? `a fixed ₹${charge.rate}`
      : charge.calculationMethodName === 'Per square foot'
        ? `₹${charge.rate} per square foot`
        : charge.calculationMethodName === 'Per unit (e.g. per parking slot)'
          ? `₹${charge.rate} per unit`
          : charge.calculationMethodName === 'Percentage of another category'
            ? `${charge.rate}% of another category`
            : `₹${charge.rate} (${charge.calculationMethodName.toLowerCase()})`

  return `${charge.categoryName}: ${basis}, billed ${charge.billingFrequencyLabel.toLowerCase()}, effective since ${charge.effectiveFrom}.`
}

export default function MyCharges() {
  const [charges, setCharges] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getMyCharges()
      .then((data) => {
        setCharges(data)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>My Charges</h2>
          <p>The maintenance charges that currently apply to your flat.</p>
        </div>
        <Link className="table-primary-btn" to="/dashboard/maintenance/my-bills">
          View My Bills
        </Link>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading your charges…</p>
      ) : charges.length === 0 ? (
        <p className="table-empty">No maintenance charges apply to your flat right now.</p>
      ) : (
        <ul className="my-charges-list">
          {charges.map((charge, index) => (
            <li key={index}>{describe(charge)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
