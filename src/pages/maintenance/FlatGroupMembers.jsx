import { useEffect, useState } from 'react'
import { listFlats } from '../../api/flats.js'
import { addFlatGroupMember, removeFlatGroupMember } from '../../api/flatGroups.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

export default function FlatGroupMembers({ group, onClose, onChanged }) {
  const [allFlats, setAllFlats] = useState([])
  const [memberIds, setMemberIds] = useState(group.flatIds || [])
  const [selectedFlatId, setSelectedFlatId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listFlats('').then(setAllFlats).catch((err) => setError(err.message))
  }, [])

  const memberFlats = allFlats.filter((flat) => memberIds.includes(flat.flatId))
  const availableFlats = allFlats.filter((flat) => !memberIds.includes(flat.flatId))

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!selectedFlatId) return

    setBusy(true)
    setError('')
    try {
      const flatId = Number(selectedFlatId)
      await addFlatGroupMember(group.flatGroupId, flatId)
      setMemberIds((prev) => [...prev, flatId])
      setSelectedFlatId('')
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (flatId) => {
    setBusy(true)
    setError('')
    try {
      await removeFlatGroupMember(group.flatGroupId, flatId)
      setMemberIds((prev) => prev.filter((id) => id !== flatId))
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form-card">
      {error && <p className="auth-banner-error">{error}</p>}

      <form className="table-search" onSubmit={handleAdd}>
        <select value={selectedFlatId} onChange={(event) => setSelectedFlatId(event.target.value)}>
          <option value="">Select a flat to add…</option>
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

      {memberFlats.length === 0 ? (
        <p className="table-empty">No flats in this group yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Flat No</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberFlats.map((flat) => (
                <tr key={flat.flatId}>
                  <td>{flat.flatNo}</td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-link-btn danger"
                      disabled={busy}
                      onClick={() => handleRemove(flat.flatId)}
                    >
                      Remove
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
