import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteNotice, listNotices, markNoticeRead, publishNotice } from '../../api/notices.js'
import { listNoticeCategories } from '../../api/noticeCategories.js'
import { getSession } from '../../api/session.js'
import { isNoticeManagerRole } from '../../config/roles.js'
import Modal from '../../components/Modal.jsx'
import NoticeForm from './NoticeForm.jsx'
import NoticeDetail from './NoticeDetail.jsx'
import '../../styles/dataTable.css'

const PRIORITY_BADGE = {
  Normal: 'badge-neutral',
  Important: 'badge-warning',
  Urgent: 'badge-danger',
}

export default function NoticeList() {
  const session = getSession()
  const canManage = isNoticeManagerRole(session?.role)

  const [notices, setNotices] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [showDrafts, setShowDrafts] = useState(false)

  const [modalNotice, setModalNotice] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailNotice, setDetailNotice] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listNotices({
        categoryId: categoryId || undefined,
        priority: priority || undefined,
        search: search || undefined,
        sortBy,
        includeDrafts: canManage && showDrafts,
      })
      setNotices(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    listNoticeCategories().then(setCategories).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, priority, sortBy, showDrafts])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    load()
  }

  const openAddModal = () => {
    setModalNotice(null)
    setModalOpen(true)
  }

  const openEditModal = (notice) => {
    setModalNotice(notice)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSaved = () => {
    setModalOpen(false)
    load()
  }

  const openDetail = async (notice) => {
    setDetailNotice(notice)
    if (!notice.isRead) {
      try {
        await markNoticeRead(notice.noticeId)
        load()
      } catch {
        // non-fatal — viewing still works even if the read-marking call fails
      }
    }
  }

  const handlePublish = async (notice) => {
    if (!window.confirm(`Publish "${notice.title}"? Residents will be able to see it, and it can no longer be edited afterward.`)) {
      return
    }
    setBusyId(notice.noticeId)
    try {
      await publishNotice(notice.noticeId)
      load()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (notice) => {
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) {
      return
    }
    setBusyId(notice.noticeId)
    try {
      await deleteNotice(notice.noticeId)
      setNotices((prev) => prev.filter((n) => n.noticeId !== notice.noticeId))
    } catch (err) {
      window.alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="table-page">
      <div className="table-page-header">
        <div>
          <h2>Notices</h2>
          <p>Society notice board — announcements, events, and important updates.</p>
        </div>
        {canManage && (
          <div className="table-header-actions">
            <Link className="table-secondary-btn" to="/dashboard/notices/categories">
              Categories
            </Link>
            <button type="button" className="table-primary-btn" onClick={openAddModal}>
              + New Notice
            </button>
          </div>
        )}
      </div>

      {canManage && (
        <div className="notice-tabs">
          <button
            type="button"
            className={showDrafts ? 'table-secondary-btn' : 'table-primary-btn'}
            onClick={() => setShowDrafts(false)}
          >
            Published
          </button>
          <button
            type="button"
            className={showDrafts ? 'table-primary-btn' : 'table-secondary-btn'}
            onClick={() => setShowDrafts(true)}
          >
            Drafts
          </button>
        </div>
      )}

      <form className="table-search table-search-wide" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          placeholder="Search title or description…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.noticeCategoryId} value={category.noticeCategoryId}>
              {category.categoryName}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          <option value="Normal">Normal</option>
          <option value="Important">Important</option>
          <option value="Urgent">Urgent</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="latest">Sort: Latest</option>
          <option value="priority">Sort: Priority</option>
          <option value="expiry">Sort: Expiry</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading notices…</p>
      ) : notices.length === 0 ? (
        <p className="table-empty">No notices found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                {canManage && showDrafts && <th>Status</th>}
                <th>Publish Date</th>
                <th>Sender</th>
                <th>Read</th>
                <th className="table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => (
                <tr key={notice.noticeId}>
                  <td>{notice.title}</td>
                  <td>{notice.categoryName}</td>
                  <td>
                    <span className={`table-badge ${PRIORITY_BADGE[notice.priority] || 'badge-neutral'}`}>
                      {notice.priority}
                    </span>
                  </td>
                  {canManage && showDrafts && (
                    <td>
                      <span className={`table-badge ${notice.status === 'Published' ? 'badge-success' : 'badge-neutral'}`}>
                        {notice.status}
                      </span>
                    </td>
                  )}
                  <td>{new Date(notice.publishDate).toLocaleString()}</td>
                  <td>{notice.createdByName}</td>
                  <td>
                    <span className={`table-badge ${notice.isRead ? 'badge-neutral' : 'badge-primary'}`}>
                      {notice.isRead ? 'Read' : 'Unread'}
                    </span>
                  </td>
                  <td className="table-actions-col">
                    <button type="button" className="table-link-btn" onClick={() => openDetail(notice)}>
                      View
                    </button>
                    {canManage && notice.status === 'Draft' && (
                      <>
                        <button type="button" className="table-link-btn" onClick={() => openEditModal(notice)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="table-link-btn"
                          disabled={busyId === notice.noticeId}
                          onClick={() => handlePublish(notice)}
                        >
                          Publish
                        </button>
                      </>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="table-link-btn danger"
                        disabled={busyId === notice.noticeId}
                        onClick={() => handleDelete(notice)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={modalNotice ? 'Edit Notice' : 'New Notice'}
          subtitle={modalNotice ? 'Update this draft notice.' : 'Create a new notice — it stays a draft until you publish it.'}
          onClose={closeModal}
        >
          <NoticeForm notice={modalNotice} onClose={closeModal} onSaved={handleSaved} />
        </Modal>
      )}

      {detailNotice && (
        <Modal title="Notice" onClose={() => setDetailNotice(null)}>
          <NoticeDetail notice={detailNotice} />
        </Modal>
      )}
    </div>
  )
}
