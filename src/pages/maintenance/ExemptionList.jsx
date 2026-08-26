import { useEffect, useState } from 'react'
import { listExemptions } from '../../api/maintenanceExemptions.js'
import Icon from '../../components/Icon.jsx'
import ExemptionForm from './ExemptionForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']

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
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-edit"
                      aria-label="Edit"
                      title="Edit"
                      onClick={() => openEditModal(exemption)}
                    >
                      <Icon paths={PENCIL_ICON_PATHS} size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <ExemptionForm exemption={modalExemption} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  )
}
