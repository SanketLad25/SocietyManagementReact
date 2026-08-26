import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createKnowledgeArticle, updateKnowledgeArticle } from '../../api/knowledgeArticles.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toInitialValues(article) {
  return {
    title: article?.title || '',
    body: article?.body || '',
    category: article?.category || '',
    isPublished: article?.isPublished ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.title.trim()) {
    errors.title = 'Title is required.'
  }

  if (!values.body.trim()) {
    errors.body = 'Body is required.'
  }

  return errors
}

export default function KnowledgeArticleForm({ article, onClose, onSaved }) {
  const isEditMode = Boolean(article)

  const [values, setValues] = useState(() => toInitialValues(article))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValues = { ...values, [name]: type === 'checkbox' ? checked : value }
    setValues(nextValues)
    if (touched[name]) {
      setErrors(validate(nextValues))
    }
  }

  const handleBlur = (event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(values))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setTouched({ title: true, body: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      title: values.title.trim(),
      body: values.body.trim(),
      category: values.category.trim() || null,
      isPublished: values.isPublished,
    }

    try {
      if (isEditMode) {
        await updateKnowledgeArticle(article.knowledgeArticleId, payload)
      } else {
        await createKnowledgeArticle(payload)
      }
      onSaved()
    } catch (err) {
      setStatus('idle')
      setServerError(err.message)
      if (err.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }))
      }
    }
  }

  return (
    <SidePanel
      title={isEditMode ? 'Edit Article' : 'Add Article'}
      subtitle={isEditMode ? 'Update this knowledge article.' : 'Add a new knowledge article.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="table-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="knowledge-article-form" className="auth-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Add article'}
          </button>
        </>
      }
    >
      <form id="knowledge-article-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="title"
        label="Title"
        placeholder="e.g. Visitor entry policy"
        value={values.title}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.title ? errors.title : undefined}
      />

      <div className="field">
        <label htmlFor="body">Body</label>
        <div className={`field-control ${touched.body && errors.body ? 'has-error' : ''}`}>
          <textarea
            id="body"
            name="body"
            rows={6}
            value={values.body}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
        {touched.body && errors.body && <p className="field-error">{errors.body}</p>}
      </div>

      <FormField
        id="category"
        label="Category (optional)"
        placeholder="e.g. Bylaws"
        value={values.category}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.category ? errors.category : undefined}
      />

      <div className="field">
        <label className="auth-checkbox">
          <input name="isPublished" type="checkbox" checked={values.isPublished} onChange={handleChange} />
          Published
        </label>
      </div>

      </form>
    </SidePanel>
  )
}
