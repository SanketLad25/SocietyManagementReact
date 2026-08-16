import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listBills } from '../../api/maintenanceBills.js'
import '../../styles/dataTable.css'

export default function MyBills() {
  const [bills, setBills] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    listBills()
      .then((data) => {
        setBills(data)
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
          <h2>My Bills</h2>
          <p>Your flat's published maintenance bills.</p>
        </div>
        <Link className="table-secondary-btn" to="/dashboard/maintenance">
          Back to My Charges
        </Link>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading your bills…</p>
      ) : bills.length === 0 ? (
        <p className="table-empty">No bills have been published for your flat yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Amount</th>
                <th>Outstanding</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.billId}>
                  <td>
                    {bill.billMonth}/{bill.billYear}
                  </td>
                  <td>{bill.amount}</td>
                  <td>{bill.outstandingAmount}</td>
                  <td>{bill.dueDate}</td>
                  <td>
                    <span className={`table-badge ${bill.status === 'Paid' ? 'badge-success' : 'badge-neutral'}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <Link className="table-link-btn" to={`/dashboard/maintenance/bills/${bill.billId}`}>
                      View Bill
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
