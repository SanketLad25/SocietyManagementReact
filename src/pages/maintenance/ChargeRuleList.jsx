import { useEffect, useState } from 'react'
import { listChargeRules } from '../../api/maintenanceChargeRules.js'
import { listMaintenanceCategories } from '../../api/maintenanceCategories.js'
import Modal from '../../components/Modal.jsx'
import ChargeRuleForm from './ChargeRuleForm.jsx'
import ReviseRateForm from './ReviseRateForm.jsx'
import '../../styles/dataTable.css'

export default function ChargeRuleList() {
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [rules, setRules] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [reviseRule, setReviseRule] = useState(null)

  const load = async (categoryId) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listChargeRules(categoryId || undefined)
      setRules(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    listMaintenanceCategories().then(setCategories).catch((err) => setError(err.message))
    load('')
  }, [])

  const handleFilterChange = (event) => {
    const value = event.target.value
    setCategoryFilter(value)
    load(value)
  }

  const closeAddModal = () => setAddModalOpen(false)
  const handleSaved = () => {
    setAddModalOpen(false)
    setReviseRule(null)
    load(categoryFilter)
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Charge Rules</h2>
          <p>Assign rates to categories — who they apply to, how they're calculated, and when they take effect.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={() => setAddModalOpen(true)}>
          + Add Rule
        </button>
      </div>

      <div className="table-search">
        <select value={categoryFilter} onChange={handleFilterChange}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.categoryName}
            </option>
          ))}
        </select>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading charge rules…</p>
      ) : rules.length === 0 ? (
        <p className="table-empty">No charge rules yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Method</th>
                <th>Applies to</th>
                <th>Rate</th>
                <th>Frequency</th>
                <th>Effective</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.ruleId}>
                  <td>{rule.categoryName}</td>
                  <td>{rule.calculationMethodName}</td>
                  <td>
                    {rule.chargeTargetTypeLabel}
                    {rule.targetLabel ? ` — ${rule.targetLabel}` : ''}
                  </td>
                  <td>{rule.rate}</td>
                  <td>{rule.billingFrequencyLabel}</td>
                  <td>
                    {rule.effectiveFrom}
                    {rule.effectiveTo ? ` to ${rule.effectiveTo}` : ' onward'}
                  </td>
                  <td>
                    <span className={`table-badge ${rule.effectiveTo ? 'badge-muted' : 'badge-success'}`}>
                      {rule.effectiveTo ? 'Superseded' : 'Current'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    {!rule.effectiveTo && (
                      <button type="button" className="table-link-btn" onClick={() => setReviseRule(rule)}>
                        Revise rate
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
        <Modal title="Add Charge Rule" subtitle="Assign a rate to a category." onClose={closeAddModal}>
          <ChargeRuleForm onClose={closeAddModal} onSaved={handleSaved} />
        </Modal>
      )}

      {reviseRule && (
        <Modal
          title={`Revise Rate — ${reviseRule.categoryName}`}
          subtitle="Start a new rate from a future date without losing the old one."
          onClose={() => setReviseRule(null)}
        >
          <ReviseRateForm rule={reviseRule} onClose={() => setReviseRule(null)} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
