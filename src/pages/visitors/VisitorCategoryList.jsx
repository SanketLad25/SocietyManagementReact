import { useEffect, useState } from 'react'
import { deleteVisitorCategory, listVisitorCategories } from '../../api/visitorCategories.js'
import Icon from '../../components/Icon.jsx'
import VisitorCategoryForm from './VisitorCategoryForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']
const TRASH_ICON_PATHS = [
  'M4 7h16',
  'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  'M10 11v6',
  'M14 11v6',
]

export default function VisitorCategoryList() {
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [modalCategory, setModalCategory] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listVisitorCategories()
      setCategories(data)
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
    setModalCategory(null)
    setModalOpen(true)
  }

  const openEditModal = (category) => {
    setModalCategory(category)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load()
  }

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.categoryName}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(category.visitorCategoryId)
    try {
      await deleteVisitorCategory(category.visitorCategoryId)
      setCategories((prev) => prev.filter((c) => c.visitorCategoryId !== category.visitorCategoryId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Visitor Categories</h2>
          <p>Categories a logged visitor can be tagged with, and their entry requirements.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Category
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p className="table-empty">No categories yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Approval required</th>
                <th>Vehicle no. required</th>
                <th>Company required</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.visitorCategoryId}>
                  <td>{category.categoryName}</td>
                  <td>
                    <span className={`table-badge ${category.requiresApprovalDefault ? 'badge-warning' : 'badge-muted'}`}>
                      {category.requiresApprovalDefault ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>{category.requiresVehicleNo ? 'Yes' : 'No'}</td>
                  <td>{category.requiresCompanyName ? 'Yes' : 'No'}</td>
                  <td>
                    <span className={`table-badge ${category.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-edit"
                      aria-label="Edit"
                      title="Edit"
                      onClick={() => openEditModal(category)}
                    >
                      <Icon paths={PENCIL_ICON_PATHS} size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-delete"
                      aria-label="Delete"
                      title="Delete"
                      disabled={deletingId === category.visitorCategoryId}
                      onClick={() => handleDelete(category)}
                    >
                      <Icon paths={TRASH_ICON_PATHS} size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <VisitorCategoryForm category={modalCategory} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  )
}
