import { useEffect, useState } from 'react'
import { listNoticeCategories } from '../../api/noticeCategories.js'
import Modal from '../../components/Modal.jsx'
import NoticeCategoryForm from './NoticeCategoryForm.jsx'
import '../../styles/dataTable.css'

export default function NoticeCategoryList() {
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalCategory, setModalCategory] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listNoticeCategories()
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
          <h2>Notice Categories</h2>
          <p>Categories your society's notices can be tagged with.</p>
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
                <tr key={category.noticeCategoryId}>
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
          subtitle={modalCategory ? 'Update this notice category.' : 'Add a new notice category.'}
          onClose={closeModal}
        >
          <NoticeCategoryForm category={modalCategory} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}
    </div>
  )
}
