// Shared bill-status -> badge-class mapping (BillDetail/CycleBillList/MyBills) now that
// PaymentService.RecomputeBillStatusAsync can set a third status, "Partially Paid", alongside
// the original binary Unpaid/Paid.
export function billStatusBadgeClass(status) {
  if (status === 'Paid') return 'badge-success'
  if (status === 'Partially Paid') return 'badge-warning'
  return 'badge-neutral'
}
