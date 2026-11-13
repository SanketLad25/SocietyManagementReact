import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getBill, listBills } from '../../api/maintenanceBills.js'
import { cancelPayment, listPaymentsForBill, recordPayment } from '../../api/payments.js'
import { amountToWords } from '../../utils/numberToWords.js'
import { generateBillPdf } from '../../utils/billPdf.js'
import { billStatusBadgeClass } from '../../utils/billStatus.js'
import { isBillingRole } from '../../config/roles.js'
import { getSession } from '../../api/session.js'
import FormField, { SelectField } from '../../components/FormField.jsx'
import '../../styles/dataTable.css'
import '../../styles/invoice.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Mirrors the backend's PaymentModes.All (Models/Entities/PaymentModes.cs) — kept as a plain local
// array the same way ComplaintForm.jsx keeps PRIORITIES, rather than a shared config constant, since
// nothing else on the frontend needs this list yet.
const PAYMENT_MODES = ['Cash', 'Cheque', 'UPI', 'NEFT', 'Card']

function formatMonthYear(month, year) {
  if (!month || !year) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

// Record-payment form (mirrors ComplaintDetail.jsx's AssignForm shape: local state, inline
// validation, a single submit that reports its own error and lets the parent decide what "done"
// means — here, re-fetching the bill + payments list so Status/OutstandingAmount/ArrearsAmount
// update immediately).
function RecordPaymentForm({ billId, defaultAmount, onRecorded, onCancel }) {
  const [values, setValues] = useState({
    amountPaid: defaultAmount > 0 ? String(defaultAmount) : '',
    paymentDate: todayIsoDate(),
    paymentMode: 'Cash',
    transactionId: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const amount = Number(values.amountPaid)
    if (!values.amountPaid || Number.isNaN(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!values.paymentDate) {
      setError('Payment date is required.')
      return
    }

    setError('')
    setStatus('submitting')
    try {
      await recordPayment({
        billId: Number(billId),
        amountPaid: amount,
        paymentDate: values.paymentDate,
        paymentMode: values.paymentMode,
        transactionId: values.transactionId.trim() || undefined,
        notes: values.notes.trim() || undefined,
      })
      await onRecorded()
    } catch (err) {
      setStatus('idle')
      setError(err.message)
    }
  }

  return (
    <form className="auth-form form-card" onSubmit={handleSubmit} noValidate>
      <p className="table-section-title">Record a payment</p>
      {error && <p className="auth-banner-error">{error}</p>}

      <FormField
        id="amountPaid"
        label="Amount paid"
        type="number"
        value={values.amountPaid}
        onChange={handleChange}
      />

      <FormField
        id="paymentDate"
        label="Payment date"
        type="date"
        value={values.paymentDate}
        onChange={handleChange}
      />

      <SelectField id="paymentMode" label="Payment mode" value={values.paymentMode} onChange={handleChange}>
        {PAYMENT_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </SelectField>

      <FormField
        id="transactionId"
        label="Transaction ID (optional)"
        placeholder="Cheque no. / UPI / NEFT reference"
        value={values.transactionId}
        onChange={handleChange}
      />

      <FormField id="notes" label="Notes (optional)" value={values.notes} onChange={handleChange} />

      <div className="form-actions">
        <button type="button" className="table-secondary-btn" onClick={onCancel} disabled={status === 'submitting'}>
          Cancel
        </button>
        <button type="submit" className="auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Recording…' : 'Record payment'}
        </button>
      </div>
    </form>
  )
}

function PaymentsSection({ billId, outstandingAmount, canManage, onChanged }) {
  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  const load = async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listPaymentsForBill(billId)
      setPayments(data)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId])

  const handleRecorded = async () => {
    setFormOpen(false)
    await load()
    await onChanged()
  }

  const handleCancel = async (payment) => {
    const reason = window.prompt(`Reason for cancelling receipt ${payment.receiptNo}:`)
    if (reason === null) {
      return
    }
    if (!reason.trim()) {
      window.alert('A reason is required to cancel a payment.')
      return
    }

    setCancellingId(payment.paymentId)
    try {
      await cancelPayment(payment.paymentId, reason.trim())
      await load()
      await onChanged()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="form-card" style={{ maxWidth: 720, margin: '16px auto 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <p className="table-section-title" style={{ margin: 0 }}>
          Payments
        </p>
        {canManage && !formOpen && (
          <button type="button" className="table-primary-btn" onClick={() => setFormOpen(true)}>
            + Record Payment
          </button>
        )}
      </div>

      {formOpen && (
        <RecordPaymentForm
          billId={billId}
          defaultAmount={outstandingAmount}
          onRecorded={handleRecorded}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {status === 'error' && <p className="auth-banner-error">{error}</p>}

      {status === 'loading' ? (
        <p className="table-empty">Loading payments…</p>
      ) : payments.length === 0 ? (
        <p className="table-empty">No payments recorded against this bill yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Status</th>
                {canManage && <th className="table-actions-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.paymentId}>
                  <td>
                    <Link to={`/dashboard/maintenance/payments/${payment.paymentId}`}>{payment.receiptNo}</Link>
                  </td>
                  <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                  <td>
                    {payment.paymentMode}
                    {payment.transactionId ? ` — ${payment.transactionId}` : ''}
                  </td>
                  <td>{payment.amountPaid.toFixed(2)}</td>
                  <td>
                    <span className={`table-badge ${payment.status === 'Cancelled' ? 'badge-muted' : 'badge-success'}`}>
                      {payment.status}
                    </span>
                    {payment.status === 'Cancelled' && payment.cancelledReason && (
                      <p className="field-hint">{payment.cancelledReason}</p>
                    )}
                  </td>
                  {canManage && (
                    <td className="table-actions-col">
                      {payment.status !== 'Cancelled' && (
                        <button
                          type="button"
                          className="table-secondary-btn"
                          disabled={cancellingId === payment.paymentId}
                          onClick={() => handleCancel(payment)}
                        >
                          {cancellingId === payment.paymentId ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function BillDetail() {
  const { billId } = useParams()
  const navigate = useNavigate()
  const session = getSession()
  const canManage = isBillingRole(session?.role)
  const [bill, setBill] = useState(null)
  const [previousBill, setPreviousBill] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const loadBill = () =>
    getBill(billId)
      .then((data) => {
        setBill(data)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })

  useEffect(() => {
    loadBill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId])

  useEffect(() => {
    if (!bill) return

    listBills(bill.flatId)
      .then((list) => {
        const earlier = (list || []).filter(
          (b) =>
            b.billId !== bill.billId &&
            (b.billYear < bill.billYear || (b.billYear === bill.billYear && b.billMonth < bill.billMonth)),
        )
        if (earlier.length === 0) {
          setPreviousBill(null)
          return
        }
        earlier.sort((a, b2) => {
          if (a.billYear !== b2.billYear) return b2.billYear - a.billYear
          return b2.billMonth - a.billMonth
        })
        setPreviousBill(earlier[0])
      })
      .catch((err) => {
        console.warn('Could not load previous bill for receipt section:', err)
        setPreviousBill(null)
      })
  }, [bill])

  if (status === 'loading') {
    return <p className="table-empty">Loading bill…</p>
  }

  if (status === 'error') {
    return <p className="auth-banner-error">{error}</p>
  }

  // outstandingAmount already has penaltyAmount folded in (MaintenanceBillingService keeps that
  // invariant from bill generation through every payment recompute) — don't add it again here.
  const amountDue = bill.outstandingAmount + bill.arrearsAmount
  const hasBankDetails = bill.bankName || bill.bankAccountNumber || bill.bankIfsc

  return (
    <div className="table-page">
      <div className="invoice-toolbar">
        <button type="button" className="table-secondary-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <button
          type="button"
          className="table-primary-btn"
          onClick={() => generateBillPdf(bill, previousBill)}
        >
          Download PDF
        </button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-letterhead">
          <p className="invoice-society-name">{bill.societyName || 'Society'}</p>
          {bill.societyRegistrationNo && <p className="invoice-registration">{bill.societyRegistrationNo}</p>}
          {bill.societyAddress && <p className="invoice-address">{bill.societyAddress}</p>}
        </div>

        <div className="invoice-label-row">
          <span className="invoice-label">BILL</span>
        </div>

        <div className="invoice-meta">
          <div className="invoice-meta-block">
            <p>
              <strong>Name:</strong> {bill.residentNames || '—'}
            </p>
            <p>
              <strong>Flat No:</strong> {bill.flatNo}
            </p>
            {bill.areaSqFt != null && (
              <p>
                <strong>Sq. Ft.:</strong> {bill.areaSqFt}
              </p>
            )}
          </div>
          <div className="invoice-meta-block align-right">
            <p>
              <strong>Bill No.</strong> {bill.billId}
            </p>
            <p>
              <strong>Due Date</strong> {bill.dueDate}
            </p>
            <p>
              <span className={`table-badge ${billStatusBadgeClass(bill.status)}`}>
                {bill.status}
              </span>
            </p>
          </div>
        </div>

        <p className="invoice-period">Bill for {formatMonthYear(bill.billMonth, bill.billYear)}</p>

        <table className="invoice-table">
          <thead>
            <tr>
              <th className="invoice-sr">Sr.</th>
              <th>Nature of Charges</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lineItems.map((item, index) => (
              <tr key={item.lineItemId}>
                <td className="invoice-sr">{index + 1}</td>
                <td>{item.categoryName}</td>
                <td>{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="invoice-totals">
            <tr>
              <td colSpan={2}>Total</td>
              <td>{bill.amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={2}>Arrears</td>
              <td>{bill.arrearsAmount.toFixed(2)}</td>
            </tr>
            {bill.penaltyAmount > 0 && (
              <tr>
                <td colSpan={2}>Penalty</td>
                <td>{bill.penaltyAmount.toFixed(2)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2}>Amount Due</td>
              <td>{amountDue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="invoice-words">{amountToWords(amountDue)}</p>

        <div className="invoice-footer">
          {bill.interestOnArrearsPercent != null && (
            <p>Interest on arrears @ {bill.interestOnArrearsPercent}% p.a.</p>
          )}
          {bill.chequePayeeName && <p>Cheque in favour of “{bill.chequePayeeName}”.</p>}
          {hasBankDetails && (
            <p>
              NEFT/IMPS: <strong>{bill.bankName}</strong>
              {bill.bankIfsc && <> · IFSC {bill.bankIfsc}</>}
              {bill.bankAccountNumber && <> · A/c No. {bill.bankAccountNumber}</>}
            </p>
          )}
          {bill.contactNumber && <p>Please share payment confirmation on {bill.contactNumber}.</p>}
        </div>
      </div>

      <PaymentsSection
        billId={bill.billId}
        outstandingAmount={bill.outstandingAmount}
        canManage={canManage}
        onChanged={loadBill}
      />
    </div>
  )
}
