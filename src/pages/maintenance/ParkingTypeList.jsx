import { useEffect, useState } from 'react'
import { listParkingTypes } from '../../api/parkingTypes.js'
import Modal from '../../components/Modal.jsx'
import ParkingTypeForm from './ParkingTypeForm.jsx'
import '../../styles/dataTable.css'

export default function ParkingTypeList() {
  const [parkingTypes, setParkingTypes] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalParkingType, setModalParkingType] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listParkingTypes()
      setParkingTypes(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openAddModal = () => {
    setModalParkingType(null)
    setModalOpen(true)
  }

  const openEditModal = (parkingType) => {
    setModalParkingType(parkingType)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load()
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Parking Types</h2>
          <p>
            Define the parking categories your society charges for separately — e.g. Two-Wheeler and
            Four-Wheeler. Leave empty if your society doesn't charge for parking separately.
          </p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Parking Type
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading parking types…</p>
      ) : parkingTypes.length === 0 ? (
        <p className="table-empty">No parking types yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type Name</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parkingTypes.map((parkingType) => (
                <tr key={parkingType.parkingTypeId}>
                  <td>{parkingType.typeName}</td>
                  <td>
                    <span className={`table-badge ${parkingType.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {parkingType.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(parkingType)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={modalParkingType ? 'Edit Parking Type' : 'Add Parking Type'}
          subtitle={modalParkingType ? 'Update this parking type.' : 'Add a new parking type.'}
          onClose={closeModal}
        >
          <ParkingTypeForm parkingType={modalParkingType} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
