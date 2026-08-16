import { useEffect, useState } from 'react'
import { listExemptions } from '../../api/maintenanceExemptions.js'
import Modal from '../../components/Modal.jsx'
import ExemptionForm from './ExemptionForm.jsx'
import '../../styles/dataTable.css'

export default function ExemptionList() {
  const [exemptions, setExemptions] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalExemption, setModalExemption] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listExemptions()
      setExemptions(data)
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
    setModalExemption(null)
    setModalOpen(true)
  }

  const openEditModal = (exemption) => {
    setModalExemption(exemption)
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
          <h2>Exemptions</h2>
          <p>Waive a maintenance category for a flat, group, wing, or the whole society.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Exemption
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading exemptions…</p>
      ) : exemptions.length === 0 ? (
        <p className="table-empty">No exemptions yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Applies to</th>
                <th>Reason</th>
                <th>Effective</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exemptions.map((exemption) => (
                <tr key={exemption.exemptionId}>
                  <td>{exemption.categoryName}</td>
                  <td>{exemption.chargeTargetTypeLabel}</td>
                  <td>{exemption.reason || '—'}</td>
                  <td>
                    {exemption.effectiveFrom}
                    {exemption.effectiveTo ? ` to ${exemption.effectiveTo}` : ' onward'}
                  </td>
                  <td>
                    <span className={`table-badge ${exemption.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {exemption.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(exemption)}>
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
          title={modalExemption ? 'Edit Exemption' : 'Add Exemption'}
          subtitle={modalExemption ? 'Update this exemption.' : 'Add a new exemption.'}
          onClose={closeModal}
        >
          <ExemptionForm exemption={modalExemption} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
