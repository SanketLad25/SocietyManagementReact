import { useEffect, useState } from 'react'
import { deleteFlat, listFlats } from '../../api/flats.js'
import { getSession } from '../../api/session.js'
import { isCommitteeRole } from '../../config/roles.js'
import Modal from '../../components/Modal.jsx'
import FlatForm from './FlatForm.jsx'
import '../../styles/dataTable.css'

export default function FlatList() {
  const session = getSession()
  const canManage = isCommitteeRole(session?.role)
  const societyName = session?.societyName || 'your society'

  const [flats, setFlats] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [modalFlat, setModalFlat] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async (term) => {
    setStatus('loading')
    setError('')
    try {
      const data = await listFlats(term)
      setFlats(data)
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

  const handleDelete = async (flat) => {
    if (!window.confirm(`Delete flat "${flat.flatNo}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(flat.flatId)
    try {
      await deleteFlat(flat.flatId)
      setFlats((prev) => prev.filter((f) => f.flatId !== flat.flatId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const openAddModal = () => {
    setModalFlat(null)
    setModalOpen(true)
  }

  const openEditModal = (flat) => {
    setModalFlat(flat)
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
          <h2>Flats</h2>
          <p>Wings, floors, and flat-level maintenance amounts at {societyName}.</p>
        </div>
        {canManage && (
          <button type="button" className="table-primary-btn" onClick={openAddModal}>
            + Add Flat
          </button>
        )}
      </div>

      <form className="table-search" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          placeholder="Search by Flat No…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading flats…</p>
      ) : flats.length === 0 ? (
        <p className="table-empty">No flats found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Flat No</th>
                <th>Wing ID</th>
                <th>Floor</th>
                <th>Area (sq ft)</th>
                <th>Maintenance</th>
                {canManage && <th className="table-actions-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {flats.map((flat) => (
                <tr key={flat.flatId}>
                  <td>{flat.flatNo}</td>
                  <td>{flat.wingId ?? '—'}</td>
                  <td>{flat.floorNo ?? '—'}</td>
                  <td>{flat.areaSqFt ?? '—'}</td>
                  <td>{flat.maintenanceAmount ?? '—'}</td>
                  {canManage && (
                    <td className="table-actions-col">
                      <button type="button" className="table-link-btn" onClick={() => openEditModal(flat)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table-link-btn danger"
                        disabled={deletingId === flat.flatId}
                        onClick={() => handleDelete(flat)}
                      >
                        {deletingId === flat.flatId ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={modalFlat ? 'Edit Flat' : 'Add Flat'}
          subtitle={modalFlat ? 'Update this flat’s details.' : 'Add a new flat.'}
          onClose={closeModal}
        >
          <FlatForm flat={modalFlat} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
