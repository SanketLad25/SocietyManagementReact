import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../../api/session.js'
import { generateBillingCycle, listBillingCycles, publishBillingCycle } from '../../api/maintenanceBilling.js'
import Modal from '../../components/Modal.jsx'
import BillingCycleForm from './BillingCycleForm.jsx'
import BillingCyclePreview from './BillingCyclePreview.jsx'
import '../../styles/dataTable.css'

const BILLING_ROLES = ['Admin', 'Treasurer']

export default function BillingCycleList() {
  const session = getSession()
  const canBill = BILLING_ROLES.includes(session?.role)

  const [cycles, setCycles] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [previewCycle, setPreviewCycle] = useState(null)
  const [busyCycleId, setBusyCycleId] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listBillingCycles()
      setCycles(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSaved = () => {
    setAddModalOpen(false)
    load()
  }

  const handleGenerate = async (cycle) => {
    if (!window.confirm(`Generate bills for "${cycle.cycleLabel}"? This cannot be undone.`)) {
      return
    }

    setBusyCycleId(cycle.cycleId)
    try {
      await generateBillingCycle(cycle.cycleId)
      await load()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setBusyCycleId(null)
    }
  }

  const handlePublish = async (cycle) => {
    if (!window.confirm(`Publish "${cycle.cycleLabel}"? Residents will be able to see their bills.`)) {
      return
    }

    setBusyCycleId(cycle.cycleId)
    try {
      await publishBillingCycle(cycle.cycleId)
      await load()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setBusyCycleId(null)
    }
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Billing Cycles</h2>
          <p>Create a billing period, preview and generate bills, then publish them to residents.</p>
        </div>
        {canBill && (
          <button type="button" className="table-primary-btn" onClick={() => setAddModalOpen(true)}>
            + Add Cycle
          </button>
        )}
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading billing cycles…</p>
      ) : cycles.length === 0 ? (
        <p className="table-empty">No billing cycles yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Period</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.cycleId}>
                  <td>{cycle.cycleLabel}</td>
                  <td>
                    {cycle.periodStart} to {cycle.periodEnd}
                  </td>
                  <td>{cycle.dueDate}</td>
                  <td>
                    <span
                      className={`table-badge ${
                        cycle.status === 'Published' ? 'badge-success' : cycle.status === 'Generated' ? 'badge-primary' : 'badge-neutral'
                      }`}
                    >
                      {cycle.status}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    {cycle.status !== 'Draft' && (
                      <Link className="table-link-btn" to={`/dashboard/maintenance/billing-cycles/${cycle.cycleId}/bills`}>
                        View Bills
                      </Link>
                    )}
                    {canBill && cycle.status === 'Draft' && (
                      <>
                        <button type="button" className="table-link-btn" onClick={() => setPreviewCycle(cycle)}>
                          Preview
                        </button>
                        <button
                          type="button"
                          className="table-link-btn"
                          disabled={busyCycleId === cycle.cycleId}
                          onClick={() => handleGenerate(cycle)}
                        >
                          Generate
                        </button>
                      </>
                    )}
                    {canBill && cycle.status === 'Generated' && (
                      <button
                        type="button"
                        className="table-link-btn"
                        disabled={busyCycleId === cycle.cycleId}
                        onClick={() => handlePublish(cycle)}
                      >
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModalOpen && (
        <Modal title="Add Billing Cycle" subtitle="Define a new billing period." onClose={() => setAddModalOpen(false)}>
          <BillingCycleForm onClose={() => setAddModalOpen(false)} onSaved={handleSaved} />
        </Modal>
      )}

      {previewCycle && (
        <Modal title={`Preview — ${previewCycle.cycleLabel}`} subtitle="Check one flat's charges before generating." onClose={() => setPreviewCycle(null)}>
          <BillingCyclePreview cycle={previewCycle} onClose={() => setPreviewCycle(null)} />
        </Modal>
      )}
    </div>
  )
}
