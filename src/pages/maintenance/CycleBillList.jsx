import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listBills } from '../../api/maintenanceBills.js'
import '../../styles/dataTable.css'

export default function CycleBillList() {
  const { cycleId } = useParams()
  const [bills, setBills] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    listBills()
      .then((data) => {
        setBills(data.filter((bill) => String(bill.cycleId) === String(cycleId)))
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [cycleId])

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Bills for this cycle</h2>
          <p>One row per flat billed in this cycle.</p>
        </div>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading bills…</p>
      ) : bills.length === 0 ? (
        <p className="table-empty">No bills for this cycle.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Flat No</th>
                <th>Amount</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.billId}>
                  <td>{bill.flatNo}</td>
                  <td>{bill.amount}</td>
                  <td>{bill.outstandingAmount}</td>
                  <td>
                    <span className={`table-badge ${bill.status === 'Paid' ? 'badge-success' : 'badge-neutral'}`}>{bill.status}</span>
                  </td>
                  <td className="table-actions-col">
                    <Link className="table-link-btn" to={`/dashboard/maintenance/bills/${bill.billId}`}>
                      View
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
