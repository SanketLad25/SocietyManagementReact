import { useEffect, useState } from 'react'
import { deleteParking, listParking } from '../../api/parking.js'
import { getSession } from '../../api/session.js'
import { isCommitteeRole } from '../../config/roles.js'
import Icon from '../../components/Icon.jsx'
import ParkingForm from './ParkingForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']
const TRASH_ICON_PATHS = [
  'M4 7h16',
  'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  'M10 11v6',
  'M14 11v6',
]

export default function ParkingList() {
  const session = getSession()
  const canManage = isCommitteeRole(session?.role)
  const societyName = session?.societyName || 'your society'

  const [parkingRows, setParkingRows] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [modalParking, setModalParking] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async (term) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listParking(term)
      setParkingRows(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    load('')
  }, [])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    load(search)
  }

  const handleDelete = async (parking) => {
    if (!window.confirm(`Remove this parking record for flat "${parking.flatNo}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(parking.parkingId)
    try {
      await deleteParking(parking.parkingId)
      setParkingRows((prev) => prev.filter((p) => p.parkingId !== parking.parkingId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const openAddModal = () => {
    setModalParking(null)
    setModalOpen(true)
  }

  const openEditModal = (parking) => {
    setModalParking(parking)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load(search)
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Parking</h2>
          <p>Flat-wise parking slot and vehicle assignments at {societyName}.</p>
        </div>
        {canManage && (
          <button type="button" className="table-primary-btn" onClick={openAddModal}>
            + Add Parking
          </button>
        )}
      </div>

      <form className="table-search" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          placeholder="Search by flat no, vehicle no, or slot no…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading parking records…</p>
      ) : parkingRows.length === 0 ? (
        <p className="table-empty">No parking records found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Flat</th>
                <th>Parking Type</th>
                <th>Slot No</th>
                <th>Vehicle No</th>
                <th>Vehicle Type</th>
                {canManage && <th className="table-actions-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {parkingRows.map((parking) => (
                <tr key={parking.parkingId}>
                  <td>{parking.flatNo}</td>
                  <td>
                    <span className="table-badge badge-primary">{parking.parkingTypeName}</span>
                  </td>
                  <td>{parking.parkingNo || '—'}</td>
                  <td>{parking.vehicleNo || '—'}</td>
                  <td>{parking.vehicleType || '—'}</td>
                  {canManage && (
                    <td className="table-actions-col">
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-edit"
                        aria-label="Edit"
                        title="Edit"
                        onClick={() => openEditModal(parking)}
                      >
                        <Icon paths={PENCIL_ICON_PATHS} size={16} />
                      </button>
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-delete"
                        aria-label="Remove"
                        title="Remove"
                        disabled={deletingId === parking.parkingId}
                        onClick={() => handleDelete(parking)}
                      >
                        <Icon paths={TRASH_ICON_PATHS} size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <ParkingForm parking={modalParking} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  )
}
