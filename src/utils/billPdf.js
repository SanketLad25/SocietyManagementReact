import jsPDF from 'jspdf'
import autoTableImport from 'jspdf-autotable'
import { amountToWords } from './numberToWords.js'

// Same tri-state as utils/billStatus.js's badge-class mapping, expressed as jsPDF RGB text colors
// instead of CSS classes: Paid stays green, the new Partially Paid gets its own amber (matching
// dataTable.css's .badge-warning color, #b45309), Unpaid keeps the original neutral gray.
function statusTextColor(status) {
  if (status === 'Paid') return [21, 128, 61]
  if (status === 'Partially Paid') return [180, 83, 9]
  return [110, 110, 110]
}

// Vite's CJS/ESM dep-optimizer re-exports jspdf-autotable's whole module.exports object as the
// default import instead of unwrapping its own nested `.default` — grab the real function either way.
const autoTable = autoTableImport.default ?? autoTableImport

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatMonthYear(month, year) {
  if (!month || !year) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// Draws "Label value" on one line with a bold label + normal-weight value.
// `x` is either the left start (align: 'left') or the right edge (align: 'right').
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
  return String(value || 'Flat').replace(/[^a-zA-Z0-9-]/g, '') || 'Flat'
}

/**
 * Builds a compact single-page A4 PDF for a maintenance bill (and, if a previous
 * bill is supplied, a payment-acknowledgement section reflecting that previous
 * bill's own recorded status — not a fabricated payment transaction record).
 *
 * @param {object} bill - MaintenanceBillResponse for the bill being viewed.
 * @param {object|null} previousBill - MaintenanceBillResponse for the immediately
 *   preceding bill period on the same flat, or null if none exists.
 */
export function generateBillPdf(bill, previousBill) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const marginX = 15
  const contentWidth = pageWidth - marginX * 2
  const centerX = pageWidth / 2
  const rightEdge = pageWidth - marginX

  let y = 16

  // ---- Letterhead ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(0)
  doc.text(bill.societyName || 'Society', centerX, y, { align: 'center' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90)
  if (bill.societyRegistrationNo) {
    doc.text(bill.societyRegistrationNo, centerX, y, { align: 'center' })
    y += 3.8
  }
  if (bill.societyAddress) {
    doc.text(bill.societyAddress, centerX, y, { align: 'center' })
    y += 3.8
  }
  doc.setTextColor(0)

  y += 2
  doc.setDrawColor(30)
  doc.setLineWidth(0.5)
  doc.line(marginX, y, rightEdge, y)
  y += 7

  // ---- BILL label ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const label = 'BILL'
  const labelBoxWidth = doc.getTextWidth(label) + 10
  doc.setLineWidth(0.3)
  doc.rect(centerX - labelBoxWidth / 2, y - 4.2, labelBoxWidth, 6)
  doc.text(label, centerX, y, { align: 'center' })
  y += 9

  // ---- Meta block (two columns) ----
  doc.setFontSize(9)
  labelValueLine(doc, marginX, y, 'Name:', bill.residentNames || '—')
  labelValueLine(doc, rightEdge, y, 'Bill No.', bill.billId, 'right')
  y += 4.6

  labelValueLine(doc, marginX, y, 'Flat No:', bill.flatNo)
  labelValueLine(doc, rightEdge, y, 'Due Date', bill.dueDate, 'right')
  y += 4.6

  if (bill.areaSqFt != null) {
    labelValueLine(doc, marginX, y, 'Sq. Ft.:', bill.areaSqFt)
  }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...statusTextColor(bill.status))
  doc.text(String(bill.status), rightEdge, y, { align: 'right' })
  doc.setTextColor(0)
  y += 7.5

  // ---- Period ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Bill for ${formatMonthYear(bill.billMonth, bill.billYear)}`, marginX, y)
  y += 4

  // ---- Line items table ----
  const rows = bill.lineItems.map((item, index) => [
    String(index + 1),
    item.categoryName,
    item.amount.toFixed(2),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Sr.', 'Nature of Charges', 'Amount']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.6, textColor: 20, lineColor: 180, lineWidth: 0.15 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
    },
  })

  y = doc.lastAutoTable.finalY + 2

  // ---- Totals ----
  // outstandingAmount already has penaltyAmount folded in — don't add it again (see BillDetail.jsx).
  const amountDue = bill.outstandingAmount + bill.arrearsAmount
  const totalsRows = [['Total', bill.amount.toFixed(2)]]
  if (bill.arrearsAmount > 0) totalsRows.push(['Arrears', bill.arrearsAmount.toFixed(2)])
  if (bill.penaltyAmount > 0) totalsRows.push(['Penalty', bill.penaltyAmount.toFixed(2)])
  totalsRows.push(['Amount Due', amountDue.toFixed(2)])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    body: totalsRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1, fontStyle: 'bold', textColor: 0 },
    columnStyles: {
      0: { cellWidth: contentWidth - 30 },
      1: { cellWidth: 30, halign: 'right' },
    },
  })

  y = doc.lastAutoTable.finalY + 4

  // ---- Amount in words ----
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  const wordsLines = doc.splitTextToSize(amountToWords(amountDue), contentWidth)
  doc.text(wordsLines, marginX, y)
  y += wordsLines.length * 4 + 2

  // ---- Footer ----
  doc.setDrawColor(190)
  doc.setLineWidth(0.2)
  doc.line(marginX, y, rightEdge, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)

  if (bill.interestOnArrearsPercent != null) {
    doc.text(`Interest on arrears @ ${bill.interestOnArrearsPercent}% p.a.`, marginX, y)
    y += 4
  }
  if (bill.chequePayeeName) {
    doc.text(`Cheque in favour of "${bill.chequePayeeName}".`, marginX, y)
    y += 4
  }
  const hasBankDetails = bill.bankName || bill.bankAccountNumber || bill.bankIfsc
  if (hasBankDetails) {
    let bankLine = `NEFT/IMPS: ${bill.bankName || ''}`
    if (bill.bankIfsc) bankLine += ` · IFSC ${bill.bankIfsc}`
    if (bill.bankAccountNumber) bankLine += ` · A/c No. ${bill.bankAccountNumber}`
    doc.text(bankLine, marginX, y)
    y += 4
  }
  if (bill.contactNumber) {
    doc.text(`Please share payment confirmation on ${bill.contactNumber}.`, marginX, y)
    y += 4
  }
  doc.setTextColor(0)

  // ---- Previous-month payment acknowledgement (only if a previous bill exists) ----
  if (previousBill) {
    y += 3
    doc.setDrawColor(120)
    doc.setLineWidth(0.4)
    if (typeof doc.setLineDashPattern === 'function') {
      doc.setLineDashPattern([2, 1.5], 0)
    }
    doc.line(marginX, y, rightEdge, y)
    if (typeof doc.setLineDashPattern === 'function') {
      doc.setLineDashPattern([], 0)
    }
    y += 7

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Previous Month — Payment Acknowledgement', marginX, y)
    y += 5.5

    doc.setFontSize(8.5)
    labelValueLine(doc, marginX, y, 'Flat No:', previousBill.flatNo)
    labelValueLine(doc, rightEdge, y, 'Bill No.', previousBill.billId, 'right')
    y += 4.4

    labelValueLine(doc, marginX, y, 'Period:', formatMonthYear(previousBill.billMonth, previousBill.billYear))
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...statusTextColor(previousBill.status))
    doc.text(String(previousBill.status), rightEdge, y, { align: 'right' })
    doc.setTextColor(0)
    y += 4.4

    labelValueLine(doc, marginX, y, 'Amount:', previousBill.amount.toFixed(2))
    if (previousBill.outstandingAmount > 0) {
      labelValueLine(doc, rightEdge, y, 'Outstanding:', previousBill.outstandingAmount.toFixed(2), 'right')
    }
    y += 5.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(130)
    const noteLines = doc.splitTextToSize(
      "This reflects the recorded status of the previous month's bill as per society records; it is not a standalone payment transaction receipt.",
      contentWidth,
    )
    doc.text(noteLines, marginX, y)
    doc.setTextColor(0)
  }

  const monthName = MONTH_NAMES[(bill.billMonth || 1) - 1] || ''
  const safeFlatNo = sanitizeForFilename(bill.flatNo)
  doc.save(`Bill-${safeFlatNo}-${monthName}-${bill.billYear}.pdf`)
}
