import { useEffect, useState } from 'react'
import { deleteResident, listResidents } from '../../api/residents.js'
import { getSession } from '../../api/session.js'
import { isCommitteeRole } from '../../config/roles.js'
import Icon from '../../components/Icon.jsx'
import ResidentForm from './ResidentForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']
const TRASH_ICON_PATHS = [
  'M4 7h16',
  'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  'M10 11v6',
  'M14 11v6',
]

export default function ResidentList() {
  const session = getSession()
  const canManage = isCommitteeRole(session?.role)
  const societyName = session?.societyName || 'your society'

  const [residents, setResidents] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [modalResident, setModalResident] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async (term) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listResidents(term)
      setResidents(data)
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

  const handleDelete = async (resident) => {
    if (!window.confirm(`Delete resident "${resident.fullName}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(resident.residentId)
    try {
      await deleteResident(resident.residentId)
      setResidents((prev) => prev.filter((r) => r.residentId !== resident.residentId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const openAddModal = () => {
    setModalResident(null)
    setModalOpen(true)
  }

  const openEditModal = (resident) => {
    setModalResident(resident)
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
          <h2>Residents</h2>
          <p>Directory of everyone registered at {societyName}.</p>
        </div>
        {canManage && (
          <button type="button" className="table-primary-btn" onClick={openAddModal}>
            + Add Resident
          </button>
        )}
      </div>

      <form className="table-search" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          placeholder="Search by name, email, or mobile…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading residents…</p>
      ) : residents.length === 0 ? (
        <p className="table-empty">No residents found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Flat</th>
                <th>Type</th>
                <th>Status</th>
                {canManage && <th className="table-actions-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.residentId}>
                  <td>{resident.fullName}</td>
                  <td>{resident.mobile || '—'}</td>
                  <td>{resident.email || '—'}</td>
                  <td>{resident.flatNo || '—'}</td>
                  <td>
                    <span className={`table-badge ${resident.isOwner ? 'badge-primary' : 'badge-neutral'}`}>
                      {resident.isOwner ? 'Owner' : 'Tenant'}
                    </span>
                  </td>
                  <td>
                    <span className={`table-badge ${resident.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {resident.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="table-actions-col">
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-edit"
                        aria-label="Edit"
                        title="Edit"
                        onClick={() => openEditModal(resident)}
                      >
                        <Icon paths={PENCIL_ICON_PATHS} size={16} />
                      </button>
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn-delete"
                        aria-label="Delete"
                        title="Delete"
                        disabled={deletingId === resident.residentId}
                        onClick={() => handleDelete(resident)}
                      >
                        <Icon paths={TRASH_ICON_PATHS} size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <ResidentForm resident={modalResident} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  )
}
