import type { VerbrauchMessmodus } from '@/lib/verbrauch-medien-katalog'

/** Rundet auf n Dezimalstellen (vermeidet Float-Artefakte wie 2.1999999999999993). */
export function roundDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Abnahme (Tank/Flasche): start − ende. */
export function verbrauchGesamtKg(wertStart: number, wertEnde: number): number {
  return roundDecimals(Math.max(0, wertStart - wertEnde), 1)
}

/**
 * Verbrauch inkl. Zwischenauffüllungen.
 * Abnahme (Gas/Petroleum): start + ΣAuffüllungen − ende
 * Zunahme (Zähler): ende − start (Auffüllungen werden ignoriert)
 */
export function verbrauchDifferenz(
  wertStart: number,
  wertEnde: number,
  messmodus: VerbrauchMessmodus = 'abnahme',
  auffuellungenSumme = 0
): number {
  const raw =
    messmodus === 'zunahme'
      ? wertEnde - wertStart
      : wertStart + auffuellungenSumme - wertEnde
  return roundDecimals(Math.max(0, raw), 1)
}

export function formatKg(value: number | null | undefined, decimals: 1 | 2): string {
  return formatVerbrauch(value, decimals)
}

export function formatVerbrauch(value: number | null | undefined, decimals: 1 | 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return roundDecimals(value, decimals).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatVerbrauchMitEinheit(
  value: number | null | undefined,
  einheit: string,
  decimals: 1 | 2
): string {
  const formatted = formatVerbrauch(value, decimals)
  if (formatted === '—') return formatted
  return `${formatted} ${einheit}`
}

/**
 * Liter aus Bruttogewicht: (brutto − leer) / dichte.
 * dichte in kg/l (z. B. Petroleum ≈ 0,80).
 */
export function literAusGewicht(
  bruttoKg: number,
  leergewichtKg: number,
  dichteKgProL: number
): number | null {
  if (!(dichteKgProL > 0) || !Number.isFinite(bruttoKg) || !Number.isFinite(leergewichtKg)) {
    return null
  }
  const netto = bruttoKg - leergewichtKg
  if (netto < 0) return null
  return roundDecimals(netto / dichteKgProL, 2)
}

