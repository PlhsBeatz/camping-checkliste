/**
 * Prefill für „temporären Eintrag → Ausrüstung“ aus historischen Temp-Zeilen.
 * Bei einheitlichen Werten: direkt übernehmen; bei Abweichungen: zuletzt genutzter Wert + Hinweise.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { formatWeightForDisplay } from '@/lib/utils'
import {
  createDefaultEquipmentFormValues,
  type EquipmentFormValues,
} from '@/lib/equipment-form'

export type TempPromoteSampleRow = {
  was: string
  kategorie_id: string
  kategorie_titel: string
  anzahl: number
  einzelgewicht: number | null
  transport_id: string | null
  transport_name: string | null
  startdatum: string
}

export type TempPromoteFieldKey =
  | 'kategorie_id'
  | 'transport_id'
  | 'einzelgewicht'
  | 'standard_anzahl'

export type TempPromotePrefillHint = {
  field: TempPromoteFieldKey
  /** Lesbarer Hinweis, z. B. „Sonst auch: 2, 3“ */
  message: string
}

export type TempPromotePrefill = {
  form: EquipmentFormValues
  hints: TempPromotePrefillHint[]
  sampleCount: number
}

function normalizeTransportId(id: string | null | undefined): string {
  const t = String(id ?? '').trim()
  return t || 'none'
}

function normalizeWeight(w: number | null | undefined): string {
  if (w == null || Number.isNaN(Number(w))) return ''
  return String(w)
}

function uniqueOrdered<T>(values: T[], keyFn: (v: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const v of values) {
    const k = keyFn(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function formatWeightLabel(w: string): string {
  if (!w) return 'ohne Gewicht'
  const n = Number(w)
  if (Number.isNaN(n)) return w
  const display = formatWeightForDisplay(n)
  return display ? `${display} kg` : w
}

function formatAnzahlLabel(n: string): string {
  return n === '1' ? '1×' : `${n}×`
}

/**
 * Baut Prefill aus bereits geladenen Temp-Zeilen (neueste zuerst empfohlen).
 * Erwartet höchstens eine begrenzte Stichprobe (API limitiert).
 */
export function buildTempPromotePrefill(
  was: string,
  rows: TempPromoteSampleRow[]
): TempPromotePrefill {
  const base = createDefaultEquipmentFormValues(was.trim())
  if (rows.length === 0) {
    return { form: base, hints: [], sampleCount: 0 }
  }

  const sorted = [...rows].sort((a, b) => b.startdatum.localeCompare(a.startdatum))
  const latest = sorted[0]!

  const kategorieId = latest.kategorie_id
  const transportId = normalizeTransportId(latest.transport_id)
  const weight = normalizeWeight(latest.einzelgewicht)
  const anzahl = String(Math.max(1, Number(latest.anzahl) || 1))

  const form: EquipmentFormValues = {
    ...base,
    was: latest.was.trim() || was.trim(),
    kategorie_id: kategorieId,
    transport_id: transportId,
    einzelgewicht: weight,
    standard_anzahl: anzahl,
  }

  const hints: TempPromotePrefillHint[] = []

  const otherKats = uniqueOrdered(
    sorted
      .filter((r) => r.kategorie_id !== kategorieId)
      .map((r) => ({ id: r.kategorie_id, label: r.kategorie_titel || r.kategorie_id })),
    (x) => x.id
  )
  if (otherKats.length > 0) {
    hints.push({
      field: 'kategorie_id',
      message: `Sonst auch: ${otherKats.map((k) => k.label).join(', ')}`,
    })
  }

  const otherTransports = uniqueOrdered(
    sorted
      .filter((r) => normalizeTransportId(r.transport_id) !== transportId)
      .map((r) => ({
        id: normalizeTransportId(r.transport_id),
        label:
          normalizeTransportId(r.transport_id) === 'none'
            ? 'ohne Transport'
            : r.transport_name?.trim() || 'unbekanntes Transportmittel',
      })),
    (x) => x.id
  )
  if (otherTransports.length > 0) {
    hints.push({
      field: 'transport_id',
      message: `Sonst auch: ${otherTransports.map((t) => t.label).join(', ')}`,
    })
  }

  const otherWeights = uniqueOrdered(
    sorted
      .map((r) => normalizeWeight(r.einzelgewicht))
      .filter((w) => w !== weight),
    (w) => w
  )
  if (otherWeights.length > 0) {
    hints.push({
      field: 'einzelgewicht',
      message: `Sonst auch: ${otherWeights.map(formatWeightLabel).join(', ')}`,
    })
  }

  const otherAnzahlen = uniqueOrdered(
    sorted
      .map((r) => String(Math.max(1, Number(r.anzahl) || 1)))
      .filter((n) => n !== anzahl),
    (n) => n
  )
  if (otherAnzahlen.length > 0) {
    hints.push({
      field: 'standard_anzahl',
      message: `Sonst auch: ${otherAnzahlen.map(formatAnzahlLabel).join(', ')}`,
    })
  }

  return { form, hints, sampleCount: sorted.length }
}

/** Max. Stichprobe – reicht für „zuletzt“ + abweichende Werte, schont D1/CPU. */
export const TEMP_PROMOTE_PREFILL_LIMIT = 40

export async function fetchTempPromoteSamples(
  db: D1Database,
  was: string,
  kategorieId: string
): Promise<TempPromoteSampleRow[]> {
  const trimmedWas = was.trim()
  const trimmedKat = kategorieId.trim()
  if (!trimmedWas || !trimmedKat) return []

  const res = await db
    .prepare(
      `SELECT pet.was, pet.kategorie_id, k.titel AS kategorie_titel,
              pet.anzahl, pet.einzelgewicht, pet.transport_id, t.name AS transport_name,
              u.startdatum
       FROM packlisten_eintraege_temporaer pet
       JOIN packlisten p ON pet.packliste_id = p.id
       JOIN urlaube u ON p.urlaub_id = u.id
       JOIN kategorien k ON pet.kategorie_id = k.id
       LEFT JOIN transportmittel t ON pet.transport_id = t.id
       WHERE lower(trim(pet.was)) = lower(?) AND pet.kategorie_id = ?
       ORDER BY u.startdatum DESC
       LIMIT ?`
    )
    .bind(trimmedWas, trimmedKat, TEMP_PROMOTE_PREFILL_LIMIT)
    .all<{
      was: string
      kategorie_id: string
      kategorie_titel: string
      anzahl: number
      einzelgewicht: number | null
      transport_id: string | null
      transport_name: string | null
      startdatum: string
    }>()

  return (res.results ?? []).map((r) => ({
    was: r.was,
    kategorie_id: r.kategorie_id,
    kategorie_titel: r.kategorie_titel,
    anzahl: Number(r.anzahl) || 1,
    einzelgewicht: r.einzelgewicht == null ? null : Number(r.einzelgewicht),
    transport_id: r.transport_id,
    transport_name: r.transport_name,
    startdatum: r.startdatum,
  }))
}
