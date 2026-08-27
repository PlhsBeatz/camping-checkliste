/** Betrag als Währung (de-DE, 2 Nachkommastellen). */
export function formatBookingMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = 'EUR'
): string {
  if (amount == null || !Number.isFinite(amount)) return ''
  const code = (currency?.trim() || 'EUR').toUpperCase()
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

/** Eingabe „1.234,56“ oder „1234.56“ → Zahl. */
export function parseBookingMoneyInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:[,.]|$))/g, '')
    .replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}
