import { useEffect, useState } from 'react'
import FormField, { SelectField } from '../../components/FormField.jsx'
import { createEvent, updateEvent } from '../../api/events.js'
import { listEventCategories } from '../../api/eventCategories.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toInitialValues(event) {
  return {
    eventCategoryId: event?.eventCategoryId != null ? String(event.eventCategoryId) : '',
    eventName: event?.eventName || '',
    description: event?.description || '',
    startOn: event ? toDateTimeLocal(event.startOn) : '',
    endOn: event ? toDateTimeLocal(event.endOn) : '',
    venue: event?.venue || '',
    coverEmoji: event?.coverEmoji || '',
    organizerName: event?.organizerName || '',
    maxParticipants: event?.maxParticipants != null ? String(event.maxParticipants) : '',
    registrationRequired: event?.registrationRequired ?? true,
  }
}

function validate(values) {
  const errors = {}

  if (!values.eventCategoryId) {
    errors.eventCategoryId = 'Category is required.'
  }
  if (!values.eventName.trim()) {
    errors.eventName = 'Event title is required.'
  }
  if (!values.description.trim()) {
    errors.description = 'Description is required.'
  }
  if (!values.startOn) {
    errors.startOn = 'Start date & time is required.'
  }
  if (values.endOn && values.startOn && values.endOn < values.startOn) {
    errors.endOn = "End time can't be before the start time."
  }
  if (!values.venue.trim()) {
    errors.venue = 'Venue is required.'
  }
  if (!values.organizerName.trim()) {
    errors.organizerName = 'Organizer name is required.'
  }
  if (values.maxParticipants && !/^\d+$/.test(values.maxParticipants.trim())) {
    errors.maxParticipants = 'Maximum participants must be a number.'
  }

  return errors
}

export default function EventForm({ event, onClose, onSaved }) {
  const isEditMode = Boolean(event)

  const [categories, setCategories] = useState([])
  const [categoriesStatus, setCategoriesStatus] = useState('loading')
  const [values, setValues] = useState(() => toInitialValues(event))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    listEventCategories()
      .then((data) => {
        setCategories(data.filter((c) => c.isActive))
        setCategoriesStatus('idle')
      })
      .catch(() => setCategoriesStatus('error'))
  }, [])

  const handleChange = (event_) => {
    const { name, value, type, checked } = event_.target
    const nextValues = { ...values, [name]: type === 'checkbox' ? checked : value }
    setValues(nextValues)
    if (touched[name]) {
      setErrors(validate(nextValues))
    }
  }

  const handleBlur = (event_) => {
    const { name } = event_.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate(values))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setTouched({
      eventCategoryId: true,
      eventName: true,
      description: true,
      startOn: true,
      endOn: true,
      venue: true,
      organizerName: true,
      maxParticipants: true,
    })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setServerError('')
    setStatus('submitting')

    const payload = {
      eventCategoryId: Number(values.eventCategoryId),
      eventName: values.eventName.trim(),
      description: values.description.trim(),
      startOn: new Date(values.startOn).toISOString(),
      endOn: values.endOn ? new Date(values.endOn).toISOString() : null,
      venue: values.venue.trim(),
      coverEmoji: values.coverEmoji.trim() || null,
      organizerName: values.organizerName.trim(),
      maxParticipants: values.maxParticipants.trim() ? Number(values.maxParticipants.trim()) : null,
      registrationRequired: values.registrationRequired,
    }

    try {
      if (isEditMode) {
        await updateEvent(event.eventId, payload)
      } else {
        await createEvent(payload)
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
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      {serverError && <p className="auth-banner-error">{serverError}</p>}

      <FormField
        id="eventName"
        label="Event title"
        placeholder="e.g. Independence Day Celebration"
        value={values.eventName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.eventName ? errors.eventName : undefined}
      />

      <SelectField
        id="eventCategoryId"
        label="Category"
        value={values.eventCategoryId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.eventCategoryId ? errors.eventCategoryId : undefined}
        disabled={categoriesStatus === 'loading'}
        hint={categoriesStatus === 'error' ? 'Could not load categories — try again.' : undefined}
      >
        <option value="">{categoriesStatus === 'loading' ? 'Loading categories…' : 'Select a category'}</option>
        {categories.map((category) => (
          <option key={category.eventCategoryId} value={category.eventCategoryId}>
            {category.categoryName}
          </option>
        ))}
      </SelectField>

      <div className="field">
        <label htmlFor="description">Description</label>
        <div className="field-control">
          <textarea
            id="description"
            name="description"
            rows={3}
            value={values.description}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
        {touched.description && errors.description && <p className="field-error">{errors.description}</p>}
      </div>

      <FormField
        id="startOn"
        label="Start date & time"
        type="datetime-local"
        value={values.startOn}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.startOn ? errors.startOn : undefined}
      />

      <FormField
        id="endOn"
        label="End date & time (optional)"
        type="datetime-local"
        value={values.endOn}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.endOn ? errors.endOn : undefined}
      />

      <FormField
        id="venue"
        label="Venue"
        placeholder="e.g. Clubhouse Lawn"
        value={values.venue}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.venue ? errors.venue : undefined}
      />

      <FormField
        id="organizerName"
        label="Organizer"
        placeholder="e.g. Cultural Committee"
        value={values.organizerName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.organizerName ? errors.organizerName : undefined}
      />

      <FormField
        id="coverEmoji"
        label="Cover emoji (optional)"
        placeholder="🎉"
        value={values.coverEmoji}
        onChange={handleChange}
        onBlur={handleBlur}
        hint="Shown as the event's card banner until a cover photo is added."
      />

      <FormField
        id="maxParticipants"
        label="Maximum participants (optional)"
        placeholder="Leave blank for no limit"
        value={values.maxParticipants}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.maxParticipants ? errors.maxParticipants : undefined}
      />

      <div className="field">
        <label className="auth-checkbox">
          <input
            name="registrationRequired"
            type="checkbox"
            checked={values.registrationRequired}
            onChange={handleChange}
          />
          Registration required
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving…' : isEditMode ? 'Save changes' : 'Publish event'}
        </button>
      </div>
    </form>
  )
}
