import { useEffect, useState } from 'react'
import { listMaintenanceCategories } from '../../api/maintenanceCategories.js'
import Modal from '../../components/Modal.jsx'
import CategoryForm from './CategoryForm.jsx'
import '../../styles/dataTable.css'

export default function CategoryList() {
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalCategory, setModalCategory] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listMaintenanceCategories()
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

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Maintenance Categories</h2>
          <p>Define the charge categories your society bills for — Water, Sinking Fund, Parking, and so on.</p>
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
                <th>Code</th>
                <th>Description</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.categoryId}>
                  <td>{category.categoryName}</td>
                  <td>{category.categoryCode || '—'}</td>
                  <td>{category.description || '—'}</td>
                  <td>
                    <span className={`table-badge ${category.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(category)}>
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
          title={modalCategory ? 'Edit Category' : 'Add Category'}
          subtitle={modalCategory ? 'Update this maintenance category.' : 'Add a new maintenance category.'}
          onClose={closeModal}
        >
          <CategoryForm category={modalCategory} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
