import jsPDF from 'jspdf'
import { amountToWords } from './numberToWords.js'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatMonthYear(month, year) {
  if (!month || !year) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function labelValueLine(doc, x, y, label, value, align = 'left') {
  const labelText = `${label} `
  const valueText = value == null ? '' : String(value)

  doc.setFont('helvetica', 'bold')
  const labelWidth = doc.getTextWidth(labelText)
  doc.setFont('helvetica', 'normal')
  const valueWidth = doc.getTextWidth(valueText)

  const startX = align === 'right' ? x - labelWidth - valueWidth : x

  doc.setFont('helvetica', 'bold')
  doc.text(labelText, startX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(valueText, startX + labelWidth, y)
}

function sanitizeForFilename(value) {
  return String(value || 'Receipt').replace(/[^a-zA-Z0-9-]/g, '') || 'Receipt'
}

/**
 * Builds a compact single-page A4 acknowledgment-receipt PDF for one payment.
 *
 * @param {object} payment - PaymentResponse for the payment being viewed.
 * @param {object} bill - MaintenanceBillResponse for the bill this payment was recorded against
 *   (source of the society letterhead, resident name, and billing period — PaymentResponse alone
 *   doesn't carry these).
 */
export function generateReceiptPdf(payment, bill) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const marginX = 15
  const contentWidth = pageWidth - marginX * 2
  const centerX = pageWidth / 2
  const rightEdge = pageWidth - marginX

  let y = 18

  // ---- Letterhead ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(0)
  doc.text(bill?.societyName || 'Society', centerX, y, { align: 'center' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90)
  if (bill?.societyRegistrationNo) {
    doc.text(bill.societyRegistrationNo, centerX, y, { align: 'center' })
    y += 3.8
  }
  if (bill?.societyAddress) {
    doc.text(bill.societyAddress, centerX, y, { align: 'center' })
    y += 3.8
  }
  doc.setTextColor(0)

  y += 2
  doc.setDrawColor(30)
  doc.setLineWidth(0.5)
  doc.line(marginX, y, rightEdge, y)
  y += 9

  // ---- RECEIPT label ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const label = payment.status === 'Cancelled' ? 'RECEIPT (CANCELLED)' : 'RECEIPT'
  const labelBoxWidth = doc.getTextWidth(label) + 10
  doc.setLineWidth(0.3)
  doc.rect(centerX - labelBoxWidth / 2, y - 4.2, labelBoxWidth, 6)
  doc.text(label, centerX, y, { align: 'center' })
  y += 10

  // ---- Meta block ----
  doc.setFontSize(9)
  labelValueLine(doc, marginX, y, 'Receipt No.:', payment.receiptNo)
  labelValueLine(doc, rightEdge, y, 'Date', formatDate(payment.paymentDate), 'right')
  y += 5.5

  labelValueLine(doc, marginX, y, 'Received From:', bill?.residentNames || '—')
  y += 5.5
  labelValueLine(doc, marginX, y, 'Flat No.:', payment.flatNo)
  y += 8

  // ---- Narrative acknowledgment line ----
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const period = formatMonthYear(bill?.billMonth, bill?.billYear)
  const refPart = payment.transactionId ? ` (Ref: ${payment.transactionId})` : ''
  const narrative =
    `Received with thanks a sum of Rs. ${payment.amountPaid.toFixed(2)} ` +
    `(${amountToWords(payment.amountPaid)}) towards Maintenance Bill No. ${payment.billId}` +
    (period ? ` for the period ${period}` : '') +
    `, paid via ${payment.paymentMode}${refPart}, dated ${formatDate(payment.paymentDate)}.`
  const narrativeLines = doc.splitTextToSize(narrative, contentWidth)
  doc.text(narrativeLines, marginX, y)
  y += narrativeLines.length * 5 + 6

  // ---- Detail table (drawn manually — small, fixed field count, autoTable is overkill here) ----
  doc.setDrawColor(200)
  doc.setLineWidth(0.2)
  doc.line(marginX, y, rightEdge, y)
  y += 6

  const rows = [
    ['Bill No.', String(payment.billId)],
    ['Payment Mode', payment.paymentMode],
  ]
  if (payment.transactionId) rows.push(['Transaction ID', payment.transactionId])
  rows.push(['Recorded By', payment.createdByName || '—'])
  rows.push(['Recorded On', new Date(payment.createdOn).toLocaleString('en-IN')])
  if (payment.notes) rows.push(['Notes', payment.notes])

  doc.setFontSize(9)
  for (const [fieldLabel, fieldValue] of rows) {
    doc.setFont('helvetica', 'bold')
    doc.text(fieldLabel, marginX, y)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(fieldValue, contentWidth - 45)
    doc.text(wrapped, marginX + 45, y)
    y += wrapped.length * 4.2 + 1.6
  }

  y += 4
  doc.setDrawColor(30)
  doc.setLineWidth(0.4)
  doc.line(marginX, y, rightEdge, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Amount Paid', marginX, y)
  doc.text(payment.amountPaid.toFixed(2), rightEdge, y, { align: 'right' })
  y += 14

  // ---- Cancelled banner ----
  if (payment.status === 'Cancelled') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(180, 30, 30)
    const cancelLine =
      'CANCELLED' +
      (payment.cancelledOn ? ` on ${new Date(payment.cancelledOn).toLocaleString('en-IN')}` : '') +
      (payment.cancelledReason ? ` — ${payment.cancelledReason}` : '')
    const cancelLines = doc.splitTextToSize(cancelLine, contentWidth)
    doc.text(cancelLines, marginX, y)
    y += cancelLines.length * 4.5 + 8
    doc.setTextColor(0)
  }

  // ---- Signature block ----
  const sigY = Math.max(y, 250)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`For ${bill?.societyName || 'Society'}`, rightEdge, sigY, { align: 'right' })
  doc.line(rightEdge - 55, sigY + 14, rightEdge, sigY + 14)
  doc.text('Authorised Signatory', rightEdge, sigY + 18, { align: 'right' })

  const safeReceiptNo = sanitizeForFilename(payment.receiptNo)
  doc.save(`${safeReceiptNo}.pdf`)
}
