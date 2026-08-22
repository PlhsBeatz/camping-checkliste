/**
 * Fälligkeits-Status und Datumsberechnung für Wartung & Verbrauch.
 * Ampel-Logik wird beim Speichern angewendet; GET liefert persistierte Werte.
 */
import {
  addCalendarDays,
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'

export type FaelligkeitKategorie =
  | 'sicherheit'
  | 'fahrzeug'
  | 'ausruestung'
  | 'versicherung'
  | 'sonstiges'

export type FaelligkeitTyp =
  | 'festes_datum'
  | 'intervall'
  | 'alter_anzeige'

/** Normalisiert Legacy-Typen aus der Datenbank. */
export function normalizeFaelligkeitTyp(typ: string): FaelligkeitTyp {
  if (typ === 'historie_mit_intervall') return 'intervall'
  return typ as FaelligkeitTyp
}

export type FaelligkeitIntervallEinheit = 'tage' | 'monate' | 'jahre'

export type FaelligkeitIntervallRhythmus = 'taggenau' | 'monatsende'

export type FaelligkeitAmpelStatus =
  | 'ok'
  | 'bald_faellig'
  | 'ueberfaellig'
  | 'nur_info'

export type FaelligkeitEreignisTyp = 'erledigt' | 'quittiert' | 'notiz'

export interface FaelligkeitCore {
  typ: FaelligkeitTyp
  bezug_datum?: string | null
  gueltig_bis?: string | null
  letzte_erledigung_am?: string | null
  naechste_faelligkeit?: string | null
  intervall_einheit?: FaelligkeitIntervallEinheit | null
  intervall_wert?: number | null
  intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
  warnung_tage_vorher: number
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.slice(0, 10).split('-')
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) }
}

/** Kalender-Monate addieren (YYYY-MM-DD). */
export function addCalendarMonths(ymd: string, months: number): string {
  const { y, m, d } = parseYmd(ymd)
  const total = (y * 12 + (m - 1)) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  const nd = Math.min(d, lastDay)
  return new Date(Date.UTC(ny, nm - 1, nd)).toISOString().slice(0, 10)
}

export function addCalendarYears(ymd: string, years: number): string {
  return addCalendarMonths(ymd, years * 12)
}

/** Letzter Kalendertag des Monats von ymd (YYYY-MM-DD). */
export function endOfCalendarMonth(ymd: string): string {
  const { y, m } = parseYmd(normalizeCalendarDate(ymd))
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1, lastDay)).toISOString().slice(0, 10)
}

/** Addiert Monate ab dem Monat von ymd; Ergebnis immer Monatsende. */
export function addMonthsToMonthEnd(ymd: string, months: number): string {
  const { y, m } = parseYmd(normalizeCalendarDate(ymd))
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return endOfCalendarMonth(`${ny}-${String(nm).padStart(2, '0')}-01`)
}

export function normalizeIntervallRhythmus(
  value: FaelligkeitIntervallRhythmus | null | undefined
): FaelligkeitIntervallRhythmus {
  return value === 'monatsende' ? 'monatsende' : 'taggenau'
}

function intervallMonths(
  einheit: FaelligkeitIntervallEinheit,
  wert: number
): number | null {
  if (wert <= 0) return null
  switch (einheit) {
    case 'monate':
      return wert
    case 'jahre':
      return wert * 12
    default:
      return null
  }
}

export function addIntervall(
  fromYmd: string,
  einheit: FaelligkeitIntervallEinheit,
  wert: number
): string {
  if (wert <= 0) return fromYmd
  switch (einheit) {
    case 'tage':
      return addCalendarDays(fromYmd, wert)
    case 'monate':
      return addCalendarMonths(fromYmd, wert)
    case 'jahre':
      return addCalendarYears(fromYmd, wert)
  }
}

/** Berechnet gueltig_bis aus Bezugsdatum + Intervall (z. B. Schlauch 10 Jahre). */
export function computeGueltigBisFromBezug(
  bezugDatum: string,
  einheit: FaelligkeitIntervallEinheit,
  wert: number
): string {
  return addIntervall(normalizeCalendarDate(bezugDatum), einheit, wert)
}

/** Nächste Fälligkeit aus letzter Erledigung + Intervall. */
export function computeNaechsteFaelligkeit(
  letzteErledigung: string,
  einheit: FaelligkeitIntervallEinheit,
  wert: number,
  rhythmus: FaelligkeitIntervallRhythmus = 'taggenau'
): string {
  const from = normalizeCalendarDate(letzteErledigung)
  if (normalizeIntervallRhythmus(rhythmus) === 'monatsende') {
    const months = intervallMonths(einheit, wert)
    if (months != null) {
      return addMonthsToMonthEnd(from, months)
    }
  }
  return addIntervall(from, einheit, wert)
}

/** Effektives Fälligkeitsdatum für Ampel-Berechnung. */
export function resolveEffectiveDueDate(f: FaelligkeitCore): string | null {
  if (f.typ === 'festes_datum') {
    return f.gueltig_bis ? normalizeCalendarDate(f.gueltig_bis) : null
  }
  if (f.typ === 'intervall') {
    if (f.naechste_faelligkeit) return normalizeCalendarDate(f.naechste_faelligkeit)
    if (
      f.letzte_erledigung_am &&
      f.intervall_einheit &&
      f.intervall_wert != null &&
      f.intervall_wert > 0
    ) {
      return computeNaechsteFaelligkeit(
        f.letzte_erledigung_am,
        f.intervall_einheit,
        f.intervall_wert,
        f.intervall_rhythmus
      )
    }
    return null
  }
  if (f.typ === 'alter_anzeige') {
    if (f.gueltig_bis) return normalizeCalendarDate(f.gueltig_bis)
    return null
  }
  return null
}

export function computeAmpelStatus(
  f: FaelligkeitCore,
  today = todayInAppTimezone()
): FaelligkeitAmpelStatus {
  if (f.typ === 'alter_anzeige' && !f.gueltig_bis) {
    return f.bezug_datum ? 'nur_info' : 'nur_info'
  }

  const due = resolveEffectiveDueDate(f)
  if (!due) {
    if (f.typ === 'alter_anzeige' && f.bezug_datum) return 'nur_info'
    return 'ok'
  }

  const daysUntil = differenceCalendarDays(due, today)
  if (daysUntil < 0) return 'ueberfaellig'
  if (daysUntil <= f.warnung_tage_vorher) return 'bald_faellig'
  return 'ok'
}

/** Alter in Jahren (ab Bezugsdatum) für Anzeige „nur Alter“. */
export function computeAlterJahre(bezugDatum: string, today = todayInAppTimezone()): number {
  const start = normalizeCalendarDate(bezugDatum)
  if (!start) return 0
  const days = differenceCalendarDays(today, start)
  return Math.max(0, Math.floor(days / 365.25))
}

export interface FaelligkeitPersistInput {
  typ: FaelligkeitTyp
  bezug_datum?: string | null
  gueltig_bis?: string | null
  letzte_erledigung_am?: string | null
  intervall_einheit?: FaelligkeitIntervallEinheit | null
  intervall_wert?: number | null
  intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
}

/** Berechnet persistierte Felder beim Anlegen/Aktualisieren. */
export function computePersistedFaelligkeitFields(
  input: FaelligkeitPersistInput
): { gueltig_bis: string | null; naechste_faelligkeit: string | null } {
  let gueltig_bis = input.gueltig_bis ? normalizeCalendarDate(input.gueltig_bis) : null
  let naechste_faelligkeit: string | null = null

  if (input.typ === 'alter_anzeige' && input.bezug_datum && !gueltig_bis) {
    if (
      input.intervall_einheit &&
      input.intervall_wert != null &&
      input.intervall_wert > 0
    ) {
      gueltig_bis = computeGueltigBisFromBezug(
        input.bezug_datum,
        input.intervall_einheit,
        input.intervall_wert
      )
    }
  }

  if (
    input.typ === 'intervall' &&
    input.letzte_erledigung_am &&
    input.intervall_einheit &&
    input.intervall_wert != null &&
    input.intervall_wert > 0
  ) {
    naechste_faelligkeit = computeNaechsteFaelligkeit(
      input.letzte_erledigung_am,
      input.intervall_einheit,
      input.intervall_wert,
      input.intervall_rhythmus
    )
  }

  if (input.typ === 'festes_datum' && gueltig_bis) {
    naechste_faelligkeit = gueltig_bis
  }

  if (input.typ === 'alter_anzeige' && gueltig_bis) {
    naechste_faelligkeit = gueltig_bis
  }

  return { gueltig_bis, naechste_faelligkeit }
}

export const FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS: Record<FaelligkeitIntervallRhythmus, string> = {
  taggenau: 'Taggenau',
  monatsende: 'Zum Monatsende',
}

export const FAELLIGKEIT_KATEGORIE_LABELS: Record<FaelligkeitKategorie, string> = {
  sicherheit: 'Sicherheit',
  fahrzeug: 'Fahrzeug',
  ausruestung: 'Ausrüstung',
  versicherung: 'Versicherung',
  sonstiges: 'Sonstiges',
}

export const FAELLIGKEIT_TYP_LABELS: Record<FaelligkeitTyp, string> = {
  festes_datum: 'Festes Datum',
  intervall: 'Intervall',
  alter_anzeige: 'Alter / Gültigkeit',
}

export const FAELLIGKEIT_AMPEL_LABELS: Record<FaelligkeitAmpelStatus, string> = {
  ok: 'OK',
  bald_faellig: 'Bald fällig',
  ueberfaellig: 'Überfällig',
  nur_info: 'Info',
}
