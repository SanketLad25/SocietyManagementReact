const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function threeDigitsToWords(n) {
  const parts = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`)
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''))
  } else if (n > 0) {
    parts.push(ONES[n])
  }
  return parts.join(' ')
}

// Indian numbering (thousand / lakh / crore), suitable for society maintenance bill amounts.
export function amountToWords(amount) {
  const whole = Math.round(Math.abs(Number(amount) || 0))
  if (whole === 0) {
    return 'Zero Rupees Only'
  }

  const crore = Math.floor(whole / 10000000)
  const lakh = Math.floor((whole % 10000000) / 100000)
  const thousand = Math.floor((whole % 100000) / 1000)
  const hundred = whole % 1000

  const segments = []
  if (crore) segments.push(`${threeDigitsToWords(crore)} Crore`)
  if (lakh) segments.push(`${threeDigitsToWords(lakh)} Lakh`)
  if (thousand) segments.push(`${threeDigitsToWords(thousand)} Thousand`)
  if (hundred) segments.push(threeDigitsToWords(hundred))

  return `Rupees ${segments.join(' ')} Only`
}
