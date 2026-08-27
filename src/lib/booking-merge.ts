import type { Buchungsstatus, StayBookingFields } from './booking-types'
import { BUCHUNGSSTATUS_LABELS } from './booking-types'
import { formatBookingMoney } from './booking-format'
import type { VacationCampingStay } from './db'

export type BookingFieldChange = {
  field: keyof StayBookingFields
  label: string
  previous: string
  next: string
}

export type BookingFieldPreserved = {
  field: keyof StayBookingFields
  label: string
  value: string
}

export type BookingMergeResult = {
  merged: StayBookingFields
  changes: BookingFieldChange[]
  preserved: BookingFieldPreserved[]
}

export function bookingChangesByField(
  preview: BookingMergeResult | null | undefined
): Partial<Record<keyof StayBookingFields, BookingFieldChange>> {
  const out: Partial<Record<keyof StayBookingFields, BookingFieldChange>> = {}
  for (const change of preview?.changes ?? []) {
    out[change.field] = change
  }
  return out
}

const FIELD_LABELS: Record<keyof StayBookingFields, string> = {
  platznummer: 'Platznummer',
  buchungsnummer: 'Buchungsnummer',
  buchungsstatus: 'Status',
  checkin_zeit: 'Check-in',
  checkout_zeit: 'Check-out',
  zugangscode: 'Zugangscode',
  unterkunftstyp: 'Unterkunftstyp',
  preis_gesamt: 'Preis gesamt',
  waehrung: 'Währung',
  anzahlung_betrag: 'Anzahlung',
  restzahlung_faellig_am: 'Restzahlung fällig',
  buchungsdatum: 'Buchungsdatum',
  stornierungsfrist: 'Stornierungsfrist',
  extras_json: 'Extras',
  kontakt_platz: 'Kontakt Platz',
  notizen_buchung: 'Notizen',
}

const STRING_FIELDS: (keyof StayBookingFields)[] = [
  'platznummer',
  'buchungsnummer',
  'checkin_zeit',
  'checkout_zeit',
  'zugangscode',
  'unterkunftstyp',
  'restzahlung_faellig_am',
  'buchungsdatum',
  'stornierungsfrist',
  'kontakt_platz',
  'notizen_buchung',
]

const NUMBER_FIELDS: (keyof StayBookingFields)[] = ['preis_gesamt', 'anzahlung_betrag']

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  const s = String(value).trim()
  return s === '' || s === '—' || s === '-'
}

function formatFieldValue(
  field: keyof StayBookingFields,
  value: unknown,
  currency = 'EUR'
): string | null {
  if (isEmptyValue(value)) return null
  if (field === 'buchungsstatus') {
    const key = String(value) as Buchungsstatus
    return BUCHUNGSSTATUS_LABELS[key] ?? String(value)
  }
  if (field === 'preis_gesamt' || field === 'anzahlung_betrag') {
    const n = typeof value === 'number' ? value : parseFloat(String(value))
    return Number.isFinite(n) ? formatBookingMoney(n, currency) : null
  }
  return String(value).trim()
}

export function stayToBookingFields(stay: VacationCampingStay): StayBookingFields {
  return {
    platznummer: stay.platznummer ?? null,
    buchungsnummer: stay.buchungsnummer ?? null,
    buchungsstatus: (stay.buchungsstatus as Buchungsstatus | null) ?? null,
    checkin_zeit: stay.checkin_zeit ?? null,
    checkout_zeit: stay.checkout_zeit ?? null,
    zugangscode: stay.zugangscode ?? null,
    unterkunftstyp: stay.unterkunftstyp ?? null,
    preis_gesamt: stay.preis_gesamt ?? null,
    waehrung: stay.waehrung ?? null,
    anzahlung_betrag: stay.anzahlung_betrag ?? null,
    restzahlung_faellig_am: stay.restzahlung_faellig_am ?? null,
    buchungsdatum: stay.buchungsdatum ?? null,
    stornierungsfrist: stay.stornierungsfrist ?? null,
    extras_json: stay.extras_json ?? null,
    kontakt_platz: stay.kontakt_platz ?? null,
    notizen_buchung: stay.notizen_buchung ?? null,
  }
}

/**
 * Führt E-Mail-Daten mit bestehenden Aufenthaltsdaten zusammen.
 * Leere oder fehlende Werte aus der E-Mail überschreiben nie bestehende Daten.
 */
export function mergeStayBookingFields(
  existing: StayBookingFields | null | undefined,
  incoming: StayBookingFields
): BookingMergeResult {
  if (!existing) {
    return { merged: { ...incoming }, changes: [], preserved: [] }
  }

  const merged: StayBookingFields = { ...existing }
  const changes: BookingFieldChange[] = []
  const preserved: BookingFieldPreserved[] = []
  const currency = existing.waehrung ?? incoming.waehrung ?? 'EUR'

  for (const field of STRING_FIELDS) {
    const incomingRaw = incoming[field]
    const existingFormatted = formatFieldValue(field, existing[field], currency)

    if (isEmptyValue(incomingRaw)) {
      if (existingFormatted) {
        preserved.push({
          field,
          label: FIELD_LABELS[field],
          value: existingFormatted,
        })
      }
      continue
    }

    const incomingFormatted = formatFieldValue(field, incomingRaw, currency)
    if (!incomingFormatted) continue

    if (existingFormatted === incomingFormatted) {
      merged[field] = String(incomingRaw).trim()
      continue
    }

    merged[field] = String(incomingRaw).trim()
    if (existingFormatted) {
      changes.push({
        field,
        label: FIELD_LABELS[field],
        previous: existingFormatted,
        next: incomingFormatted,
      })
    }
  }

  if (incoming.buchungsstatus != null) {
    const existingFormatted = formatFieldValue('buchungsstatus', existing.buchungsstatus, currency)
    const incomingFormatted = formatFieldValue('buchungsstatus', incoming.buchungsstatus, currency)
    if (existingFormatted !== incomingFormatted) {
      merged.buchungsstatus = incoming.buchungsstatus
      if (existingFormatted && incomingFormatted) {
        changes.push({
          field: 'buchungsstatus',
          label: FIELD_LABELS.buchungsstatus,
          previous: existingFormatted,
          next: incomingFormatted,
        })
      }
    }
  } else if (formatFieldValue('buchungsstatus', existing.buchungsstatus, currency)) {
    preserved.push({
      field: 'buchungsstatus',
      label: FIELD_LABELS.buchungsstatus,
      value: formatFieldValue('buchungsstatus', existing.buchungsstatus, currency)!,
    })
  }

  for (const field of NUMBER_FIELDS) {
    const incomingRaw = incoming[field]
    const existingFormatted = formatFieldValue(field, existing[field], currency)

    if (incomingRaw == null || incomingRaw === '') {
      if (existingFormatted) {
        preserved.push({
          field,
          label: FIELD_LABELS[field],
          value: existingFormatted,
        })
      }
      continue
    }

    const incomingFormatted = formatFieldValue(field, incomingRaw, currency)
    if (!incomingFormatted) continue

    merged[field] = typeof incomingRaw === 'number' ? incomingRaw : parseFloat(String(incomingRaw))

    if (existingFormatted && existingFormatted !== incomingFormatted) {
      changes.push({
        field,
        label: FIELD_LABELS[field],
        previous: existingFormatted,
        next: incomingFormatted,
      })
    }
  }

  if (!isEmptyValue(incoming.waehrung) && incoming.waehrung !== existing.waehrung) {
    merged.waehrung = incoming.waehrung
  }

  return { merged, changes, preserved }
}
