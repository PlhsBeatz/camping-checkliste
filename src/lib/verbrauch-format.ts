/** Rundet auf n Dezimalstellen (vermeidet Float-Artefakte wie 2.1999999999999993). */
export function roundDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function verbrauchGesamtKg(wertStart: number, wertEnde: number): number {
  return roundDecimals(Math.max(0, wertStart - wertEnde), 1)
}

export function formatKg(value: number | null | undefined, decimals: 1 | 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return roundDecimals(value, decimals).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
