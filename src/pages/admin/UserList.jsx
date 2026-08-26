import { useEffect, useState } from 'react'
import { listUsers } from '../../api/adminUsers.js'
import Icon from '../../components/Icon.jsx'
import Modal from '../../components/Modal.jsx'
import UserForm from './UserForm.jsx'
import ResetPasswordForm from './ResetPasswordForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']

export default function UserList() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalUser, setModalUser] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [resetUser, setResetUser] = useState(null)

  const load = () => {
    setStatus('loading')
    setError('')
    listUsers()
      .then((data) => {
        setUsers(data)
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
    setModalUser(null)
    setModalOpen(true)
  }

  const openEditModal = (user) => {
    setModalUser(user)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load()
  }

  const closeResetModal = () => setResetUser(null)

  const handlePasswordReset = () => {
    setResetUser(null)
    load()
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Manage Users</h2>
          <p>Create and manage login accounts for your society.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add User
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="table-empty">No users found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full name</th>
                <th>Role</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>{user.username}</td>
                  <td>{user.fullName || '—'}</td>
                  <td>
                    <span className="table-badge badge-primary">{user.roleName}</span>
                  </td>
                  <td>
                    <span className={`table-badge ${user.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-edit"
                      aria-label="Edit"
                      title="Edit"
                      onClick={() => openEditModal(user)}
                    >
                      <Icon paths={PENCIL_ICON_PATHS} size={16} />
                    </button>
                    <button type="button" className="table-link-btn" onClick={() => setResetUser(user)}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <UserForm user={modalUser} onClose={closeModal} onSaved={handleSaved} />}

      {resetUser && (
        <Modal title="Reset Password" subtitle="Set a new password for this user." onClose={closeResetModal}>
          <ResetPasswordForm user={resetUser} onClose={closeResetModal} onSaved={handlePasswordReset} />
        </Modal>
      )}
    </div>
  )
}
