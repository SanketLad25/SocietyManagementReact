import { useEffect, useState } from 'react'
import { deleteEventCategory, listEventCategories } from '../../api/eventCategories.js'
import Modal from '../../components/Modal.jsx'
import EventCategoryForm from './EventCategoryForm.jsx'
import '../../styles/dataTable.css'

export default function EventCategoryList() {
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
      const data = await listEventCategories()
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

    setDeletingId(category.eventCategoryId)
    try {
      await deleteEventCategory(category.eventCategoryId)
      setCategories((prev) => prev.filter((c) => c.eventCategoryId !== category.eventCategoryId))
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
          <h2>Event Categories</h2>
          <p>Categories your society's events can be tagged with.</p>
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
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.eventCategoryId}>
                  <td>{category.categoryName}</td>
                  <td>
                    <span className={`table-badge ${category.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openEditModal(category)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-link-btn danger"
                      disabled={deletingId === category.eventCategoryId}
                      onClick={() => handleDelete(category)}
                    >
                      {deletingId === category.eventCategoryId ? 'Deleting…' : 'Delete'}
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
          subtitle={modalCategory ? 'Update this event category.' : 'Add a new event category.'}
          onClose={closeModal}
        >
          <EventCategoryForm category={modalCategory} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
