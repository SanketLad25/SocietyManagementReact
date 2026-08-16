import { useEffect, useState } from 'react'
import { listFlats } from '../../api/flats.js'
import { cancelAmenitySubscription, createAmenitySubscription, listAmenitySubscriptions } from '../../api/amenitySubscriptions.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function AmenitySubscriptions({ amenity, onClose }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [flats, setFlats] = useState([])
  const [selectedFlatId, setSelectedFlatId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [subs, flatList] = await Promise.all([listAmenitySubscriptions(amenity.amenityId), listFlats('')])
      setSubscriptions(subs)
      setFlats(flatList)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeFlatIds = subscriptions.filter((s) => !s.effectiveTo).map((s) => s.flatId)
  const availableFlats = flats.filter((f) => !activeFlatIds.includes(f.flatId))

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!selectedFlatId) return

    setBusy(true)
    setError('')
    try {
      await createAmenitySubscription(amenity.amenityId, { flatId: Number(selectedFlatId), effectiveFrom: today() })
      setSelectedFlatId('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async (subscriptionId) => {
    setBusy(true)
    setError('')
    try {
      await cancelAmenitySubscription(amenity.amenityId, subscriptionId, today())
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const activeSubs = subscriptions.filter((s) => !s.effectiveTo)

  return (
    <div className="form-card">
      {error && <p className="auth-banner-error">{error}</p>}

      <form className="table-search" onSubmit={handleAdd}>
        <select value={selectedFlatId} onChange={(event) => setSelectedFlatId(event.target.value)}>
          <option value="">Select a flat to subscribe…</option>
          {availableFlats.map((flat) => (
            <option key={flat.flatId} value={flat.flatId}>
              {flat.flatNo}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !selectedFlatId}>
          Add
        </button>
      </form>

      {activeSubs.length === 0 ? (
        <p className="table-empty">No flats subscribed yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Flat No</th>
                <th>Since</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeSubs.map((sub) => (
                <tr key={sub.subscriptionId}>
                  <td>{sub.flatNo}</td>
                  <td>{sub.effectiveFrom}</td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-link-btn danger"
                      disabled={busy}
                      onClick={() => handleCancel(sub.subscriptionId)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
