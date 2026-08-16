import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getComplaint, getComplaintStats, listComplaints, subscribeToComplaintsChanged } from '../../api/complaints.js'
import { listComplaintCategories } from '../../api/complaintCategories.js'
import { getSession } from '../../api/session.js'
import Modal from '../../components/Modal.jsx'
import ComplaintForm from './ComplaintForm.jsx'
import ComplaintDetail from './ComplaintDetail.jsx'
import '../../styles/dataTable.css'

const STAT_CARDS = [
  { key: 'TotalCount', label: 'Total' },
  { key: 'ActiveCount', label: 'Active' },
  { key: 'Open', label: 'Open', fromByStatus: true },
  { key: 'Assigned', label: 'Assigned', fromByStatus: true },
  { key: 'InProgress', label: 'In Progress', fromByStatus: true },
  { key: 'Resolved', label: 'Resolved', fromByStatus: true },
  { key: 'Closed', label: 'Closed', fromByStatus: true },
]

function StatsCards({ stats }) {
  if (!stats) return null

  return (
    <div className="stats-card-row">
      {STAT_CARDS.map((card) => (
        <div className="stats-card" key={card.key}>
          <span className="stats-card-value">{card.fromByStatus ? stats.byStatus?.[card.key] ?? 0 : stats[card.key.charAt(0).toLowerCase() + card.key.slice(1)] ?? 0}</span>
          <span className="stats-card-label">{card.label}</span>
        </div>
      ))}
    </div>
  )
}

const STATUS_BADGE = {
  Open: 'badge-neutral',
  Assigned: 'badge-primary',
  InProgress: 'badge-warning',
  Resolved: 'badge-success',
  Closed: 'badge-muted',
}
const PRIORITY_BADGE = { Low: 'badge-neutral', Medium: 'badge-warning', High: 'badge-danger' }

export default function ComplaintList() {
  const session = getSession()
  const isResident = session?.role === 'Resident'
  const isAdmin = session?.role === 'Admin'
  const navigate = useNavigate()

  const [complaints, setComplaints] = useState([])
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedComplaint, setSelectedComplaint] = useState(null)

  const load = async (params) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listComplaints(params)
      setComplaints(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const loadStats = () => {
    getComplaintStats().then(setStats).catch(() => {})
  }

  useEffect(() => {
    listComplaintCategories().then(setCategories).catch(() => {})
    load({})
    loadStats()
    const unsubscribe = subscribeToComplaintsChanged(loadStats)
    return unsubscribe
  }, [])

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    load({ status: statusFilter, categoryId: categoryFilter, priority: priorityFilter, search })
  }

  const openAddModal = () => setAddModalOpen(true)
  const closeAddModal = () => setAddModalOpen(false)
  const handleCreated = () => {
    setAddModalOpen(false)
    load({ status: statusFilter, categoryId: categoryFilter, priority: priorityFilter, search })
  }

  const openDetail = (complaint) => setSelectedComplaint(complaint)
  const closeDetail = () => {
    setSelectedComplaint(null)
    load({ status: statusFilter, categoryId: categoryFilter, priority: priorityFilter, search })
  }
  // Keeps the detail modal open and refreshes just its data — an Admin working through
  // assign → status updates → comments shouldn't get bounced back to the list after each step.
  const handleDetailChanged = async () => {
    const fresh = await getComplaint(selectedComplaint.complaintId)
    setSelectedComplaint(fresh)
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Complaints</h2>
          <p>Every complaint raised across your society.</p>
        </div>
        <div className="table-header-actions">
          {isAdmin && (
            <button type="button" className="table-secondary-btn" onClick={() => navigate('/dashboard/complaints/categories')}>
              Categories
            </button>
          )}
          {isResident && (
            <button type="button" className="table-primary-btn" onClick={openAddModal}>
              + Raise Complaint
            </button>
          )}
        </div>
      </div>

      <StatsCards stats={stats} />

      <form className="table-search table-search-wide" onSubmit={handleFilterSubmit}>
        <input type="search" placeholder="Search description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['Open', 'Assigned', 'InProgress', 'Resolved', 'Closed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.complaintCategoryId} value={c.complaintCategoryId}>
              {c.categoryName}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {['Low', 'Medium', 'High'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading complaints…</p>
      ) : complaints.length === 0 ? (
        <p className="table-empty">No complaints found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Raised by</th>
                <th>Flat</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised on</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.complaintId}>
                  <td>{complaint.categoryName}</td>
                  <td>{complaint.description.length > 60 ? `${complaint.description.slice(0, 60)}…` : complaint.description}</td>
                  <td>{complaint.residentName || '—'}</td>
                  <td>{complaint.flatNo || '—'}</td>
                  <td>
                    <span className={`table-badge ${PRIORITY_BADGE[complaint.priority] || 'badge-neutral'}`}>{complaint.priority}</span>
                  </td>
                  <td>
                    <span className={`table-badge ${STATUS_BADGE[complaint.status] || 'badge-neutral'}`}>{complaint.status}</span>
                  </td>
                  <td>{new Date(complaint.createdOn).toLocaleDateString()}</td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openDetail(complaint)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModalOpen && (
        <Modal title="Raise Complaint" subtitle="Tell us what's wrong and we'll get it sorted." onClose={closeAddModal}>
          <ComplaintForm onClose={closeAddModal} onSaved={handleCreated} />
        </Modal>
      )}

      {selectedComplaint && (
        <Modal
          title={`Complaint #${selectedComplaint.complaintId}`}
          subtitle={selectedComplaint.categoryName}
          onClose={closeDetail}
        >
          <ComplaintDetail complaint={selectedComplaint} onChanged={handleDetailChanged} />
        </Modal>
      )}
    </div>
  )
}
