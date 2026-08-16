import { useEffect, useState } from 'react'
import { listAmenities } from '../../api/amenities.js'
import Modal from '../../components/Modal.jsx'
import AmenityForm from './AmenityForm.jsx'
import AmenitySubscriptions from './AmenitySubscriptions.jsx'
import '../../styles/dataTable.css'

export default function AmenityList() {
  const [amenities, setAmenities] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalAmenity, setModalAmenity] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [subscriptionsAmenity, setSubscriptionsAmenity] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listAmenities()
      setAmenities(data)
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
    setModalAmenity(null)
    setModalOpen(true)
  }

  const openEditModal = (amenity) => {
    setModalAmenity(amenity)
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
          <h2>Amenities</h2>
          <p>Gym, swimming pool, clubhouse, garden, and any other shared facilities your society offers.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Amenity
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading amenities…</p>
      ) : amenities.length === 0 ? (
        <p className="table-empty">No amenities yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Amenity Name</th>
                <th>Description</th>
                <th>Opt-in required?</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {amenities.map((amenity) => (
                <tr key={amenity.amenityId}>
                  <td>{amenity.amenityName}</td>
                  <td>{amenity.description || '—'}</td>
                  <td>{amenity.requiresOptIn ? 'Yes' : 'No'}</td>
                  <td>
                    <span className={`table-badge ${amenity.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {amenity.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    {amenity.requiresOptIn && (
                      <button type="button" className="table-link-btn" onClick={() => setSubscriptionsAmenity(amenity)}>
                        Manage subscriptions
                      </button>
                    )}
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(amenity)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subscriptionsAmenity && (
        <Modal
          title={`Subscriptions — ${subscriptionsAmenity.amenityName}`}
          subtitle="Add or remove flats subscribed to this amenity."
          onClose={() => setSubscriptionsAmenity(null)}
        >
          <AmenitySubscriptions amenity={subscriptionsAmenity} onClose={() => setSubscriptionsAmenity(null)} />
        </Modal>
      )}

      {modalOpen && (
        <Modal
          title={modalAmenity ? 'Edit Amenity' : 'Add Amenity'}
          subtitle={modalAmenity ? 'Update this amenity.' : 'Add a new amenity.'}
          onClose={closeModal}
        >
          <AmenityForm amenity={modalAmenity} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
