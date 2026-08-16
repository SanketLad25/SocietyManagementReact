import { useEffect, useState } from 'react'
import { listSocieties } from '../../api/societies.js'
import Modal from '../../components/Modal.jsx'
import SocietyForm from './SocietyForm.jsx'
import '../../styles/dataTable.css'

export default function SocietyList() {
  const [societies, setSocieties] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSociety, setEditingSociety] = useState(null)

  const load = () => {
    setStatus('loading')
    setError('')
    listSocieties()
      .then((data) => {
        setSocieties(data)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }

  useEffect(() => {
    load()
  }, [])

  const openAddModal = () => {
    setEditingSociety(null)
    setModalOpen(true)
  }

  const openEditModal = (society) => {
    setEditingSociety(society)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = (options) => {
    load()
    if (!options?.refreshOnly) {
      setModalOpen(false)
    }
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Societies</h2>
          <p>Every society on the platform.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Society
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading societies…</p>
      ) : societies.length === 0 ? (
        <p className="table-empty">No societies found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>State</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {societies.map((society) => (
                <tr key={society.societyId}>
                  <td>{society.societyName}</td>
                  <td>{society.city || '—'}</td>
                  <td>{society.state || '—'}</td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(society)}>
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
          title={editingSociety ? 'Edit Society' : 'Add Society'}
          subtitle={
            editingSociety
              ? 'Update registration, bank, and contact details for this society.'
              : 'Create a new society, then its first Admin account.'
          }
          onClose={closeModal}
        >
          <SocietyForm existingSociety={editingSociety} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
