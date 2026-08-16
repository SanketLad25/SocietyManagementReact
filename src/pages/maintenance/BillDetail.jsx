import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBill } from '../../api/maintenanceBills.js'
import { amountToWords } from '../../utils/numberToWords.js'
import '../../styles/dataTable.css'
import '../../styles/invoice.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatMonthYear(month, year) {
  if (!month || !year) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export default function BillDetail() {
  const { billId } = useParams()
  const navigate = useNavigate()
  const [bill, setBill] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getBill(billId)
      .then((data) => {
        setBill(data)
        setStatus('idle')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [billId])

  if (status === 'loading') {
    return <p className="table-empty">Loading bill…</p>
  }

  if (status === 'error') {
    return <p className="auth-banner-error">{error}</p>
  }

  const amountDue = bill.outstandingAmount + bill.penaltyAmount + bill.arrearsAmount
  const hasBankDetails = bill.bankName || bill.bankAccountNumber || bill.bankIfsc

  return (
    <div className="table-page invoice-print-area">
      <div className="invoice-toolbar">
        <button type="button" className="table-secondary-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <button type="button" className="table-primary-btn" onClick={() => window.print()}>
          Print
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
              <span className={`table-badge ${bill.status === 'Paid' ? 'badge-success' : 'badge-neutral'}`}>
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
    </div>
  )
}
