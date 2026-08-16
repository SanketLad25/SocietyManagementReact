import { useEffect, useState } from 'react'
import { deleteParking, listParking } from '../../api/parking.js'
import { getSession } from '../../api/session.js'
import { isCommitteeRole } from '../../config/roles.js'
import Modal from '../../components/Modal.jsx'
import ParkingForm from './ParkingForm.jsx'
import '../../styles/dataTable.css'

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
                      <button type="button" className="table-link-btn" onClick={() => openEditModal(parking)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table-link-btn danger"
                        disabled={deletingId === parking.parkingId}
                        onClick={() => handleDelete(parking)}
                      >
                        {deletingId === parking.parkingId ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={modalParking ? 'Edit Parking' : 'Add Parking'}
          subtitle={
            modalParking
              ? 'Update this parking slot/vehicle assignment.'
              : 'Assign a parking slot or vehicle to a flat.'
          }
          onClose={closeModal}
        >
          <ParkingForm parking={modalParking} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
