import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPayment } from '../../api/payments.js'
import { getBill } from '../../api/maintenanceBills.js'
import { amountToWords } from '../../utils/numberToWords.js'
import { generateReceiptPdf } from '../../utils/receiptPdf.js'
import Icon from '../../components/Icon.jsx'
import '../../styles/dataTable.css'
import '../../styles/invoice.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DOWNLOAD_ICON = ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']

function formatMonthYear(month, year) {
  if (!month || !year) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// A Payment row IS the receipt (PaymentService.cs's header comment) — but PaymentResponse alone
// doesn't carry the society letterhead / resident name / billing period a real acknowledgment
// receipt needs, so this page also fetches the linked bill (existing getBill endpoint, no backend
// change) purely as a data source for those fields. The bill's own line items aren't shown here —
// this is a receipt for the payment, not a second copy of the bill.
export default function ReceiptDetail() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [bill, setBill] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getPayment(paymentId)
      .then(async (data) => {
        setPayment(data)
        try {
          const billData = await getBill(data.billId)
          setBill(billData)
        } catch (err) {
          // The receipt itself is still valid without the bill's letterhead context — degrade
          // gracefully (society name falls back to a generic label) rather than failing the page.
          console.warn('Could not load the linked bill for this receipt:', err)
        }
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [paymentId])

  if (status === 'loading') {
    return <p className="table-empty">Loading receipt…</p>
  }

  if (status === 'error') {
    return <p className="auth-banner-error">{error}</p>
  }

  const period = formatMonthYear(bill?.billMonth, bill?.billYear)
  const isCancelled = payment.status === 'Cancelled'

  return (
    <div className="table-page">
      <div className="invoice-toolbar">
        <button type="button" className="table-secondary-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <button
          type="button"
          className="table-primary-btn"
          style={{ gap: 6 }}
          onClick={() => generateReceiptPdf(payment, bill)}
          aria-label="Download PDF"
          title="Download PDF"
        >
          <Icon paths={DOWNLOAD_ICON} size={18} />
          Download PDF
        </button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-letterhead">
          <p className="invoice-society-name">{bill?.societyName || 'Society'}</p>
          {bill?.societyRegistrationNo && <p className="invoice-registration">{bill.societyRegistrationNo}</p>}
          {bill?.societyAddress && <p className="invoice-address">{bill.societyAddress}</p>}
        </div>

        <div className="invoice-label-row">
          <span className="invoice-label">{isCancelled ? 'RECEIPT (CANCELLED)' : 'RECEIPT'}</span>
        </div>

        <div className="invoice-meta">
          <div className="invoice-meta-block">
            <p>
              <strong>Receipt No.:</strong> {payment.receiptNo}
            </p>
            <p>
              <strong>Received From:</strong> {bill?.residentNames || '—'}
            </p>
            <p>
              <strong>Flat No:</strong> {payment.flatNo}
            </p>
          </div>
          <div className="invoice-meta-block align-right">
            <p>
              <strong>Date</strong> {new Date(payment.paymentDate).toLocaleDateString()}
            </p>
            <p>
              <span className={`table-badge ${isCancelled ? 'badge-muted' : 'badge-success'}`}>{payment.status}</span>
            </p>
          </div>
        </div>

        <p className="invoice-words" style={{ fontStyle: 'normal', marginTop: 14 }}>
          Received with thanks a sum of ₹{payment.amountPaid.toFixed(2)} ({amountToWords(payment.amountPaid)})
          towards Maintenance Bill No. {payment.billId}
          {period ? ` for the period ${period}` : ''}, paid via {payment.paymentMode}
          {payment.transactionId ? ` (Ref: ${payment.transactionId})` : ''}, dated{' '}
          {new Date(payment.paymentDate).toLocaleDateString()}.
        </p>

        <table className="invoice-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Detail</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bill No.</td>
              <td>{payment.billId}</td>
            </tr>
            <tr>
              <td>Payment Mode</td>
              <td>{payment.paymentMode}</td>
            </tr>
            {payment.transactionId && (
              <tr>
                <td>Transaction ID</td>
                <td>{payment.transactionId}</td>
              </tr>
            )}
            <tr>
              <td>Recorded by</td>
              <td>{payment.createdByName}</td>
            </tr>
            <tr>
              <td>Recorded on</td>
              <td>{new Date(payment.createdOn).toLocaleString()}</td>
            </tr>
            {payment.notes && (
              <tr>
                <td>Notes</td>
                <td>{payment.notes}</td>
              </tr>
            )}
          </tbody>
          <tfoot className="invoice-totals">
            <tr>
              <td>Amount Paid</td>
              <td>{payment.amountPaid.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {isCancelled && (
          <div className="invoice-footer">
            <p>
              <strong>Cancelled</strong>
              {payment.cancelledOn ? ` on ${new Date(payment.cancelledOn).toLocaleString()}` : ''}
              {payment.cancelledReason ? ` — ${payment.cancelledReason}` : ''}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40 }}>
          <div style={{ textAlign: 'center', minWidth: 200 }}>
            <p style={{ margin: '0 0 36px' }}>For {bill?.societyName || 'Society'}</p>
            <p style={{ margin: 0, borderTop: '1px solid var(--border)', paddingTop: 6 }}>Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}
