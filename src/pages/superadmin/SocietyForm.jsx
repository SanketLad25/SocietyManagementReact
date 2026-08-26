import { useState } from 'react'
import FormField from '../../components/FormField.jsx'
import SidePanel from '../../components/SidePanel.jsx'
import { createFirstAdmin, createSociety, updateSociety } from '../../api/societies.js'
import '../../styles/auth.css'
import '../../styles/dataTable.css'

const BLANK_SOCIETY_VALUES = {
  societyName: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  registrationNo: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  chequePayeeName: '',
  contactNumber: '',
  interestOnArrearsPercent: '',
}
const INITIAL_ADMIN_VALUES = { username: '', password: '' }

function toSocietyValues(society) {
  if (!society) {
    return BLANK_SOCIETY_VALUES
  }
  return {
    societyName: society.societyName || '',
    address: society.address || '',
    city: society.city || '',
    state: society.state || '',
    pinCode: society.pinCode || '',
    registrationNo: society.registrationNo || '',
    bankName: society.bankName || '',
    bankAccountNumber: society.bankAccountNumber || '',
    bankIfsc: society.bankIfsc || '',
    chequePayeeName: society.chequePayeeName || '',
    contactNumber: society.contactNumber || '',
    interestOnArrearsPercent: society.interestOnArrearsPercent != null ? String(society.interestOnArrearsPercent) : '',
  }
}

function validateSociety(values) {
  const errors = {}
  if (!values.societyName.trim()) {
    errors.societyName = 'Society name is required.'
  }
  if (values.interestOnArrearsPercent && Number.isNaN(Number(values.interestOnArrearsPercent))) {
    errors.interestOnArrearsPercent = 'Enter a valid number.'
  }
  return errors
}

function toSocietyPayload(values) {
  return {
    societyName: values.societyName.trim(),
    address: values.address.trim() || undefined,
    city: values.city.trim() || undefined,
    state: values.state.trim() || undefined,
    pinCode: values.pinCode.trim() || undefined,
    registrationNo: values.registrationNo.trim() || undefined,
    bankName: values.bankName.trim() || undefined,
    bankAccountNumber: values.bankAccountNumber.trim() || undefined,
    bankIfsc: values.bankIfsc.trim() || undefined,
    chequePayeeName: values.chequePayeeName.trim() || undefined,
    contactNumber: values.contactNumber.trim() || undefined,
    interestOnArrearsPercent: values.interestOnArrearsPercent.trim()
      ? Number(values.interestOnArrearsPercent.trim())
      : undefined,
  }
}

function validateAdmin(values) {
  const errors = {}
  if (!values.username.trim()) {
    errors.username = 'Username is required.'
  }
  if (!values.password || values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }
  return errors
}

export default function SocietyForm({ existingSociety, onClose, onSaved }) {
  const isEditMode = Boolean(existingSociety)

  const [createdSociety, setCreatedSociety] = useState(null)
  const [societyValues, setSocietyValues] = useState(() => toSocietyValues(existingSociety))
  const [societyErrors, setSocietyErrors] = useState({})
  const [societyTouched, setSocietyTouched] = useState({})
  const [societyStatus, setSocietyStatus] = useState('idle')
  const [societyServerError, setSocietyServerError] = useState('')

  const [adminValues, setAdminValues] = useState(INITIAL_ADMIN_VALUES)
  const [adminErrors, setAdminErrors] = useState({})
  const [adminTouched, setAdminTouched] = useState({})
  const [adminStatus, setAdminStatus] = useState('idle')
  const [adminServerError, setAdminServerError] = useState('')

  const handleSocietyChange = (event) => {
    const { name, value } = event.target
    const nextValues = { ...societyValues, [name]: value }
    setSocietyValues(nextValues)
    if (societyTouched[name]) {
      setSocietyErrors(validateSociety(nextValues))
    }
  }

  const handleSocietyBlur = (event) => {
    const { name } = event.target
    setSocietyTouched((prev) => ({ ...prev, [name]: true }))
    setSocietyErrors(validateSociety(societyValues))
  }

  const handleSocietySubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateSociety(societyValues)
    setSocietyErrors(nextErrors)
    setSocietyTouched({ societyName: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSocietyServerError('')
    setSocietyStatus('submitting')

    try {
      if (isEditMode) {
        await updateSociety(existingSociety.societyId, toSocietyPayload(societyValues))
        setSocietyStatus('idle')
        onSaved()
      } else {
        const created = await createSociety(toSocietyPayload(societyValues))
        setCreatedSociety(created)
        setSocietyStatus('idle')
        onSaved({ refreshOnly: true })
      }
    } catch (err) {
      setSocietyStatus('idle')
      setSocietyServerError(err.message)
    }
  }

  const handleAdminChange = (event) => {
    const { name, value } = event.target
    const nextValues = { ...adminValues, [name]: value }
    setAdminValues(nextValues)
    if (adminTouched[name]) {
      setAdminErrors(validateAdmin(nextValues))
    }
  }

  const handleAdminBlur = (event) => {
    const { name } = event.target
    setAdminTouched((prev) => ({ ...prev, [name]: true }))
    setAdminErrors(validateAdmin(adminValues))
  }

  const handleAdminSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateAdmin(adminValues)
    setAdminErrors(nextErrors)
    setAdminTouched({ username: true, password: true })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setAdminServerError('')
    setAdminStatus('submitting')

    try {
      await createFirstAdmin(createdSociety.societyId, {
        username: adminValues.username.trim(),
        password: adminValues.password,
        roleName: 'Admin',
      })
      onSaved()
    } catch (err) {
      setAdminStatus('idle')
      setAdminServerError(err.message)
    }
  }

  const societyFormFields = (
    <>
      <FormField
        id="societyName"
        label="Society name"
        value={societyValues.societyName}
        onChange={handleSocietyChange}
        onBlur={handleSocietyBlur}
        error={societyTouched.societyName ? societyErrors.societyName : undefined}
      />
      <FormField id="address" label="Address (optional)" value={societyValues.address} onChange={handleSocietyChange} />
      <FormField id="city" label="City (optional)" value={societyValues.city} onChange={handleSocietyChange} />
      <FormField id="state" label="State (optional)" value={societyValues.state} onChange={handleSocietyChange} />
      <FormField id="pinCode" label="PIN code (optional)" value={societyValues.pinCode} onChange={handleSocietyChange} />
      <FormField
        id="registrationNo"
        label="Registration number (optional)"
        value={societyValues.registrationNo}
        onChange={handleSocietyChange}
        hint="Shown on printed maintenance bills, e.g. BOM/HSG/5562 OF 1978."
      />

      <p className="table-section-title">Bank & payment details</p>
      <p className="table-section-subtitle">Used on maintenance bills for cheque/NEFT/IMPS payment instructions.</p>

      <FormField id="bankName" label="Bank name (optional)" value={societyValues.bankName} onChange={handleSocietyChange} />
      <FormField
        id="bankAccountNumber"
        label="Bank account number (optional)"
        value={societyValues.bankAccountNumber}
        onChange={handleSocietyChange}
      />
      <FormField id="bankIfsc" label="IFSC code (optional)" value={societyValues.bankIfsc} onChange={handleSocietyChange} />
      <FormField
        id="chequePayeeName"
        label="Cheque payable to (optional)"
        value={societyValues.chequePayeeName}
        onChange={handleSocietyChange}
        placeholder='e.g. "Shubhangi CHS Ltd"'
      />
      <FormField
        id="contactNumber"
        label="Payment contact / WhatsApp number (optional)"
        value={societyValues.contactNumber}
        onChange={handleSocietyChange}
      />
      <FormField
        id="interestOnArrearsPercent"
        label="Interest on arrears, % p.a. (optional)"
        value={societyValues.interestOnArrearsPercent}
        onChange={handleSocietyChange}
        onBlur={handleSocietyBlur}
        error={societyTouched.interestOnArrearsPercent ? societyErrors.interestOnArrearsPercent : undefined}
      />
    </>
  )

  // Title/subtitle intentionally stay a two-way ternary on isEditMode only — matching exactly what
  // the parent's <Modal> passed before this conversion. They do NOT change once the admin-creation
  // step appears; only the footer buttons and the active form id switch for that step.
  const title = isEditMode ? 'Edit Society' : 'Add Society'
  const subtitle = isEditMode
    ? 'Update registration, bank, and contact details for this society.'
    : 'Create a new society, then its first Admin account.'

  const onAdminStep = !isEditMode && Boolean(createdSociety)

  const footer = onAdminStep ? (
    <>
      <button type="button" className="table-secondary-btn" onClick={onClose}>
        Skip for now
      </button>
      <button type="submit" form="society-admin-form" className="auth-submit" disabled={adminStatus === 'submitting'}>
        {adminStatus === 'submitting' ? 'Creating…' : 'Create admin'}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="table-secondary-btn" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form="society-form" className="auth-submit" disabled={societyStatus === 'submitting'}>
        {societyStatus === 'submitting' ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Save changes' : 'Create society'}
      </button>
    </>
  )

  return (
    <SidePanel title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      {onAdminStep ? (
        <form id="society-admin-form" className="auth-form" onSubmit={handleAdminSubmit} noValidate>
          <p className="auth-banner-success">“{createdSociety.societyName}” created. Now set up its first Admin account.</p>
          {adminServerError && <p className="auth-banner-error">{adminServerError}</p>}

          <FormField
            id="username"
            label="Admin username"
            value={adminValues.username}
            onChange={handleAdminChange}
            onBlur={handleAdminBlur}
            error={adminTouched.username ? adminErrors.username : undefined}
          />
          <FormField
            id="password"
            label="Initial password"
            type="password"
            value={adminValues.password}
            onChange={handleAdminChange}
            onBlur={handleAdminBlur}
            error={adminTouched.password ? adminErrors.password : undefined}
            hint="Share this with the new Admin directly."
          />
        </form>
      ) : (
        <form id="society-form" className="auth-form" onSubmit={handleSocietySubmit} noValidate>
          {societyServerError && <p className="auth-banner-error">{societyServerError}</p>}
          {societyFormFields}
        </form>
      )}
    </SidePanel>
  )
}
