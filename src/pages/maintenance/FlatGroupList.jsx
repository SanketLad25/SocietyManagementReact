import { useEffect, useState } from 'react'
import { listFlatGroups } from '../../api/flatGroups.js'
import Modal from '../../components/Modal.jsx'
import FlatGroupForm from './FlatGroupForm.jsx'
import FlatGroupMembers from './FlatGroupMembers.jsx'
import '../../styles/dataTable.css'

export default function FlatGroupList() {
  const [groups, setGroups] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalGroup, setModalGroup] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [membersGroup, setMembersGroup] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listFlatGroups()
      setGroups(data)
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
    setModalGroup(null)
    setModalOpen(true)
  }

  const openEditModal = (group) => {
    setModalGroup(group)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load()
  }

  const closeMembers = () => {
    setMembersGroup(null)
    load()
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Flat Groups</h2>
          <p>Group flats together so a maintenance charge can target the whole group at once.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Group
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading flat groups…</p>
      ) : groups.length === 0 ? (
        <p className="table-empty">No flat groups yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Description</th>
                <th>Members</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.flatGroupId}>
                  <td>{group.groupName}</td>
                  <td>{group.description || '—'}</td>
                  <td>{group.flatIds.length}</td>
                  <td>
                    <span className={`table-badge ${group.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => setMembersGroup(group)}>
                      Members
                    </button>
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(group)}>
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
          title={modalGroup ? 'Edit Flat Group' : 'Add Flat Group'}
          subtitle={modalGroup ? 'Update this flat group.' : 'Add a new flat group.'}
          onClose={closeModal}
        >
          <FlatGroupForm group={modalGroup} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}

      {membersGroup && (
        <Modal
          title={`Members — ${membersGroup.groupName}`}
          subtitle="Add or remove flats from this group."
          onClose={closeMembers}
        >
          <FlatGroupMembers group={membersGroup} onClose={closeMembers} />
        </Modal>
      )}
    </div>
  )
}
