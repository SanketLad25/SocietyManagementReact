import { useEffect, useState } from 'react'
import { listKnowledgeArticles } from '../../api/knowledgeArticles.js'
import Icon from '../../components/Icon.jsx'
import KnowledgeArticleForm from './KnowledgeArticleForm.jsx'
import '../../styles/dataTable.css'

const PENCIL_ICON_PATHS = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']

export default function KnowledgeArticleList() {
  const [articles, setArticles] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalArticle, setModalArticle] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listKnowledgeArticles()
      setArticles(data)
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
    setModalArticle(null)
    setModalOpen(true)
  }

  const openEditModal = (article) => {
    setModalArticle(article)
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
          <h2>Knowledge Base</h2>
          <p>FAQs, policies, and bylaws the AI assistant can draw on when answering residents.</p>
        </div>
        <button type="button" className="table-primary-btn" onClick={openAddModal}>
          + Add Article
        </button>
      </div>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading articles…</p>
      ) : articles.length === 0 ? (
        <p className="table-empty">No knowledge articles yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.knowledgeArticleId}>
                  <td>{article.title}</td>
                  <td>{article.category || <span className="table-hint">—</span>}</td>
                  <td>
                    <span className={`table-badge ${article.isPublished ? 'badge-success' : 'badge-muted'}`}>
                      {article.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn-edit"
                      aria-label="Edit"
                      title="Edit"
                      onClick={() => openEditModal(article)}
                    >
                      <Icon paths={PENCIL_ICON_PATHS} size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <KnowledgeArticleForm article={modalArticle} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  )
}
