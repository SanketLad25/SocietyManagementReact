import { useEffect, useState } from 'react'
import { listFlats } from '../../api/flats.js'
import { previewBillingCycle } from '../../api/maintenanceBilling.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

export default function BillingCyclePreview({ cycle, onClose }) {
  const [flats, setFlats] = useState([])
  const [selectedFlatId, setSelectedFlatId] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    listFlats('').then(setFlats).catch((err) => setError(err.message))
  }, [])

  const handlePreview = async (event) => {
    event.preventDefault()
    if (!selectedFlatId) return

    setStatus('loading')
    setError('')
    setPreview(null)

    try {
      const data = await previewBillingCycle(cycle.cycleId, selectedFlatId)
      setPreview(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="form-card">
      {error && <p className="auth-banner-error">{error}</p>}

      <p className="table-hint">
        Preview computes charges for one flat without saving anything — use it to sanity-check before generating.
      </p>

      <form className="table-search" onSubmit={handlePreview}>
        <select value={selectedFlatId} onChange={(event) => setSelectedFlatId(event.target.value)}>
          <option value="">Select a flat…</option>
          {flats.map((flat) => (
            <option key={flat.flatId} value={flat.flatId}>
              {flat.flatNo}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!selectedFlatId || status === 'loading'}>
          {status === 'loading' ? 'Loading…' : 'Preview'}
        </button>
      </form>

      {preview && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={2}>No charges apply to this flat for this period.</td>
                </tr>
              ) : (
                preview.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.categoryName}</td>
                    <td>{item.amount}</td>
                  </tr>
                ))
              )}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{preview.totalAmount}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
