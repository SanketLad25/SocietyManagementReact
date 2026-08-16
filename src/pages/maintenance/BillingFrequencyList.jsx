import { useEffect, useState } from 'react'
import { listBillingFrequencies } from '../../api/billingFrequencies.js'
import Modal from '../../components/Modal.jsx'
import BillingFrequencyForm from './BillingFrequencyForm.jsx'
import '../../styles/dataTable.css'

export default function BillingFrequencyList() {
  const [frequencies, setFrequencies] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalFrequency, setModalFrequency] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listBillingFrequencies()
      setFrequencies(data)
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
    setModalFrequency(null)
    setModalOpen(true)
  }

  const openEditModal = (frequency) => {
    setModalFrequency(frequency)
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
          <h2>Billing Frequencies</h2>
          <p>Define how often each maintenance charge is billed — monthly, quarterly, one-time, etc.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Frequency
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading billing frequencies…</p>
      ) : frequencies.length === 0 ? (
        <p className="table-empty">No billing frequencies yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Interval (months)</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {frequencies.map((frequency) => (
                <tr key={frequency.billingFrequencyId}>
                  <td>{frequency.label}</td>
                  <td>{frequency.intervalMonths === 0 ? 'One-time' : frequency.intervalMonths}</td>
                  <td>
                    <span className={`table-badge ${frequency.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {frequency.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(frequency)}>
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
          title={modalFrequency ? 'Edit Billing Frequency' : 'Add Billing Frequency'}
          subtitle={modalFrequency ? 'Update this billing frequency.' : 'Add a new billing frequency.'}
          onClose={closeModal}
        >
          <BillingFrequencyForm frequency={modalFrequency} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
