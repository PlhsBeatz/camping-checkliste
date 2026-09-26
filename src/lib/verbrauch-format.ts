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

export type VerbrauchDecimals = 0 | 1 | 2

export function formatVerbrauch(
  value: number | null | undefined,
  decimals: VerbrauchDecimals
): string {
  if (value == null || Number.isNaN(value)) return '—'
  return roundDecimals(value, decimals).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Kleine Mengen in lesbarere Untereinheit umrechnen
 * (z. B. 0,35 kg → 350 g; 0,2 l → 200 ml).
 */
export function scaleVerbrauchAnzeige(
  value: number,
  einheit: string
): { value: number; einheit: string; decimals: VerbrauchDecimals } {
  const u = einheit.trim().toLowerCase()
  if (u === 'kg' && Math.abs(value) > 0 && Math.abs(value) < 1) {
    return { value: value * 1000, einheit: 'g', decimals: 0 }
  }
  if ((u === 'l' || u === 'liter') && Math.abs(value) > 0 && Math.abs(value) < 1) {
    return { value: value * 1000, einheit: 'ml', decimals: 0 }
  }
  return {
    value,
    einheit,
    decimals: Number.isInteger(roundDecimals(value, 2)) ? 0 : 1,
  }
}

export function formatVerbrauchMitEinheit(
  value: number | null | undefined,
  einheit: string,
  decimals: 1 | 2 = 1,
  opts?: { scale?: boolean }
): string {
  if (value == null || Number.isNaN(value)) return '—'
  const scale = opts?.scale !== false
  if (scale) {
    const scaled = scaleVerbrauchAnzeige(value, einheit)
    const converted =
      scaled.einheit !== einheit.trim() &&
      (scaled.einheit === 'g' || scaled.einheit === 'ml')
    const d = converted ? scaled.decimals : decimals
    return `${formatVerbrauch(scaled.value, d)} ${scaled.einheit}`
  }
  return `${formatVerbrauch(value, decimals)} ${einheit}`
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
