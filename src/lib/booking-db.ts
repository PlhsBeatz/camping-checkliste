import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import type {
  BookingImportPending,
  BookingImportQuelle,
  CampingStayEmailTyp,
  ParsedBookingFields,
  StayBookingFields,
  UrlaubCampingplatzEmail,
} from './booking-types'
import { parseBookingEmail } from './booking-email-parser'
import { decodeMimeHeaderValue } from './booking-email-headers'
import { buildGmailSearchLink } from './gmail-links'
import { suggestStayMatch } from './booking-stay-matcher'
import {
  deriveAndPersistVacationDates,
  getCampingStaysForVacation,
  type CampingStayInput,
} from './db'
import { mergeStayBookingFields } from './booking-merge'

const MAX_TEXT_LEN = 8000

function truncateText(text: string | null | undefined): string | null {
  if (!text) return null
  const t = text.trim()
  if (t.length <= MAX_TEXT_LEN) return t
  return t.slice(0, MAX_TEXT_LEN)
}

function mapPendingRow(row: Record<string, unknown>): BookingImportPending {
  return {
    id: String(row.id),
    status: String(row.status) as BookingImportPending['status'],
    quelle: String(row.quelle) as BookingImportPending['quelle'],
    betreff: row.betreff != null ? decodeMimeHeaderValue(String(row.betreff)) : null,
    absender: row.absender != null ? String(row.absender) : null,
    empfangen_am: String(row.empfangen_am),
    inhalt_text: row.inhalt_text != null ? String(row.inhalt_text) : null,
    message_id: row.message_id != null ? String(row.message_id) : null,
    parsed_fields_json:
      row.parsed_fields_json != null ? String(row.parsed_fields_json) : null,
    vorgeschlagener_urlaub_id:
      row.vorgeschlagener_urlaub_id != null
        ? String(row.vorgeschlagener_urlaub_id)
        : null,
    r2_object_key: row.r2_object_key != null ? String(row.r2_object_key) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapEmailRow(row: Record<string, unknown>): UrlaubCampingplatzEmail {
  return {
    id: String(row.id),
    stay_id: String(row.stay_id),
    email_typ: String(row.email_typ) as CampingStayEmailTyp,
    betreff: row.betreff != null ? decodeMimeHeaderValue(String(row.betreff)) : null,
    absender: row.absender != null ? String(row.absender) : null,
    empfangen_am: row.empfangen_am != null ? String(row.empfangen_am) : null,
    gmail_suchlink: row.gmail_suchlink != null ? String(row.gmail_suchlink) : null,
    inhalt_text: row.inhalt_text != null ? String(row.inhalt_text) : null,
    r2_object_key: row.r2_object_key != null ? String(row.r2_object_key) : null,
    import_pending_id:
      row.import_pending_id != null ? String(row.import_pending_id) : null,
    created_at: String(row.created_at),
  }
}

export function mapStayBookingFromRow(
  row: Record<string, unknown>
): StayBookingFields {
  return {
    platznummer: row.platznummer != null ? String(row.platznummer) : null,
    buchungsnummer: row.buchungsnummer != null ? String(row.buchungsnummer) : null,
    buchungsstatus:
      row.buchungsstatus != null
        ? (String(row.buchungsstatus) as StayBookingFields['buchungsstatus'])
        : null,
    checkin_zeit: row.checkin_zeit != null ? String(row.checkin_zeit) : null,
    checkout_zeit: row.checkout_zeit != null ? String(row.checkout_zeit) : null,
    zugangscode: row.zugangscode != null ? String(row.zugangscode) : null,
    unterkunftstyp: row.unterkunftstyp != null ? String(row.unterkunftstyp) : null,
    preis_gesamt: row.preis_gesamt != null ? Number(row.preis_gesamt) : null,
    waehrung: row.waehrung != null ? String(row.waehrung) : null,
    anzahlung_betrag:
      row.anzahlung_betrag != null ? Number(row.anzahlung_betrag) : null,
    restzahlung_faellig_am:
      row.restzahlung_faellig_am != null ? String(row.restzahlung_faellig_am) : null,
    buchungsdatum: row.buchungsdatum != null ? String(row.buchungsdatum) : null,
    stornierungsfrist:
      row.stornierungsfrist != null ? String(row.stornierungsfrist) : null,
    extras_json: row.extras_json != null ? String(row.extras_json) : null,
    kontakt_platz: row.kontakt_platz != null ? String(row.kontakt_platz) : null,
    notizen_buchung:
      row.notizen_buchung != null ? String(row.notizen_buchung) : null,
  }
}

export async function updateCampingStayBooking(
  db: D1Database,
  stayId: string,
  booking: StayBookingFields
): Promise<boolean> {
  try {
    const current = await db
      .prepare(`SELECT restzahlung_faellig_am FROM urlaub_campingplaetze WHERE id = ?`)
      .bind(stayId)
      .first<{ restzahlung_faellig_am: string | null }>()

    const newDue = booking.restzahlung_faellig_am ?? null
    const oldDue = current?.restzahlung_faellig_am ?? null
    const dueChanged = String(newDue ?? '') !== String(oldDue ?? '')

    await db
      .prepare(
        `UPDATE urlaub_campingplaetze SET
          platznummer = ?, buchungsnummer = ?, buchungsstatus = ?,
          checkin_zeit = ?, checkout_zeit = ?, zugangscode = ?,
          unterkunftstyp = ?, preis_gesamt = ?, waehrung = ?,
          anzahlung_betrag = ?, restzahlung_faellig_am = ?,
          buchungsdatum = ?, stornierungsfrist = ?, extras_json = ?,
          kontakt_platz = ?, notizen_buchung = ?
         WHERE id = ?`
      )
      .bind(
        booking.platznummer ?? null,
        booking.buchungsnummer ?? null,
        booking.buchungsstatus ?? null,
        booking.checkin_zeit ?? null,
        booking.checkout_zeit ?? null,
        booking.zugangscode ?? null,
        booking.unterkunftstyp ?? null,
        booking.preis_gesamt ?? null,
        booking.waehrung ?? 'EUR',
        booking.anzahlung_betrag ?? null,
        booking.restzahlung_faellig_am ?? null,
        booking.buchungsdatum ?? null,
        booking.stornierungsfrist ?? null,
        booking.extras_json ?? null,
        booking.kontakt_platz ?? null,
        booking.notizen_buchung ?? null,
        stayId
      )
      .run()

    if (dueChanged) {
      try {
        await db
          .prepare(`UPDATE urlaub_campingplaetze SET push_restzahlung_30d_sent = 0 WHERE id = ?`)
          .bind(stayId)
          .run()
      } catch {
        // Migration 0052 noch nicht angewendet
      }
    }

    return true
  } catch (error) {
    console.error('Error updating stay booking:', error)
    return false
  }
}

export async function countPendingBookingImports(db: D1Database): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM booking_import_pending WHERE status = 'pending'`
      )
      .first<{ c: number }>()
    return Number(row?.c ?? 0)
  } catch {
    return 0
  }
}

export async function listPendingBookingImports(
  db: D1Database
): Promise<BookingImportPending[]> {
  try {
    const result = await db
      .prepare(
        `SELECT * FROM booking_import_pending WHERE status = 'pending'
         ORDER BY empfangen_am DESC`
      )
      .all<Record<string, unknown>>()
    return (result.results ?? []).map(mapPendingRow)
  } catch (error) {
    console.error('Error listing pending imports:', error)
    return []
  }
}

export async function getBookingImportPending(
  db: D1Database,
  id: string
): Promise<BookingImportPending | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM booking_import_pending WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapPendingRow(row) : null
  } catch (error) {
    console.error('Error fetching pending import:', error)
    return null
  }
}

export async function dismissBookingImport(
  db: D1Database,
  id: string
): Promise<boolean> {
  try {
    await db
      .prepare(
        `UPDATE booking_import_pending SET status = 'dismissed', updated_at = datetime('now') WHERE id = ?`
      )
      .bind(id)
      .run()
    return true
  } catch (error) {
    console.error('Error dismissing import:', error)
    return false
  }
}

export async function createBookingImportPending(
  db: D1Database,
  opts: {
    quelle: BookingImportQuelle
    betreff?: string | null
    absender?: string | null
    inhalt_text: string
    message_id?: string | null
    empfangen_am?: string
  }
): Promise<BookingImportPending | null> {
  try {
    const parsed = parseBookingEmail(opts.inhalt_text, opts.betreff ?? '')
    const suggestion = await suggestStayMatch(db, parsed, {
      betreff: opts.betreff,
      absender: opts.absender,
    })
    const id = crypto.randomUUID()
    const parsedJson = JSON.stringify(parsed)

    await db
      .prepare(
        `INSERT INTO booking_import_pending (
          id, status, quelle, betreff, absender, empfangen_am, inhalt_text,
          message_id, parsed_fields_json, vorgeschlagener_urlaub_id
        ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        opts.quelle,
        opts.betreff ?? null,
        opts.absender ?? null,
        opts.empfangen_am ?? new Date().toISOString(),
        truncateText(opts.inhalt_text),
        opts.message_id ?? null,
        parsedJson,
        suggestion?.urlaub_id ?? null
      )
      .run()

    return getBookingImportPending(db, id)
  } catch (error) {
    console.error('Error creating pending import:', error)
    return null
  }
}

export async function getEmailsForStay(
  db: D1Database,
  stayId: string
): Promise<UrlaubCampingplatzEmail[]> {
  try {
    const result = await db
      .prepare(
        `SELECT * FROM urlaub_campingplatz_emails WHERE stay_id = ? ORDER BY empfangen_am DESC, created_at DESC`
      )
      .bind(stayId)
      .all<Record<string, unknown>>()
    return (result.results ?? []).map(mapEmailRow)
  } catch (error) {
    console.error('Error fetching stay emails:', error)
    return []
  }
}

export async function getEmailsForStays(
  db: D1Database,
  stayIds: string[]
): Promise<Record<string, UrlaubCampingplatzEmail[]>> {
  const out: Record<string, UrlaubCampingplatzEmail[]> = {}
  for (const id of stayIds) out[id] = []
  if (stayIds.length === 0) return out
  try {
    const placeholders = stayIds.map(() => '?').join(',')
    const result = await db
      .prepare(
        `SELECT * FROM urlaub_campingplatz_emails WHERE stay_id IN (${placeholders})
         ORDER BY empfangen_am DESC, created_at DESC`
      )
      .bind(...stayIds)
      .all<Record<string, unknown>>()
    for (const row of result.results ?? []) {
      const email = mapEmailRow(row)
      const existing = out[email.stay_id]
      if (existing) existing.push(email)
      else out[email.stay_id] = [email]
    }
  } catch (error) {
    console.error('Error batch fetching stay emails:', error)
  }
  return out
}

async function insertStayEmail(
  db: D1Database,
  opts: {
    stay_id: string
    email_typ: CampingStayEmailTyp
    betreff?: string | null
    absender?: string | null
    empfangen_am?: string | null
    gmail_suchlink?: string | null
    inhalt_text?: string | null
    import_pending_id?: string | null
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO urlaub_campingplatz_emails (
        id, stay_id, email_typ, betreff, absender, empfangen_am,
        gmail_suchlink, inhalt_text, import_pending_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      opts.stay_id,
      opts.email_typ,
      opts.betreff ?? null,
      opts.absender ?? null,
      opts.empfangen_am ?? null,
      opts.gmail_suchlink ?? null,
      truncateText(opts.inhalt_text ?? null),
      opts.import_pending_id ?? null
    )
    .run()
}

export type ConfirmBookingImportInput = {
  pending_id: string
  urlaub_id: string
  stay_id?: string | null
  campingplatz_id?: string | null
  start_datum?: string | null
  end_datum?: string | null
  email_typ?: CampingStayEmailTyp
  booking: StayBookingFields
  buchung_abreise_extra_tag?: boolean
  buchung_end_datum?: string | null
}

export async function confirmBookingImport(
  db: D1Database,
  input: ConfirmBookingImportInput
): Promise<{ stay_id: string } | null> {
  const pending = await getBookingImportPending(db, input.pending_id)
  if (!pending || pending.status !== 'pending') return null

  let stayId = input.stay_id ?? null

  if (stayId) {
    const exists = await db
      .prepare(
        'SELECT id FROM urlaub_campingplaetze WHERE id = ? AND urlaub_id = ?'
      )
      .bind(stayId, input.urlaub_id)
      .first()
    if (!exists) stayId = null
  }

  if (!stayId && input.campingplatz_id) {
    stayId = crypto.randomUUID()
    const sortRow = await db
      .prepare(
        'SELECT COALESCE(MAX(sort_index), -1) + 1 AS next_idx FROM urlaub_campingplaetze WHERE urlaub_id = ?'
      )
      .bind(input.urlaub_id)
      .first<{ next_idx: number }>()
    const sortIndex = Number(sortRow?.next_idx ?? 0)
    await db
      .prepare(
        `INSERT INTO urlaub_campingplaetze (
          id, urlaub_id, campingplatz_id, start_datum, end_datum, sort_index
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        stayId,
        input.urlaub_id,
        input.campingplatz_id,
        input.start_datum ?? null,
        input.end_datum ?? null,
        sortIndex
      )
      .run()
    await deriveAndPersistVacationDates(db, input.urlaub_id)
  }

  if (!stayId) return null

  let bookingToSave = input.booking
  if (input.stay_id) {
    const stayRow = await db
      .prepare('SELECT * FROM urlaub_campingplaetze WHERE id = ? AND urlaub_id = ?')
      .bind(stayId, input.urlaub_id)
      .first<Record<string, unknown>>()
    if (stayRow) {
      bookingToSave = mergeStayBookingFields(
        mapStayBookingFromRow(stayRow),
        input.booking
      ).merged
    }
  }

  if (input.start_datum || input.end_datum) {
    await db
      .prepare(
        `UPDATE urlaub_campingplaetze SET start_datum = COALESCE(?, start_datum), end_datum = COALESCE(?, end_datum) WHERE id = ?`
      )
      .bind(input.start_datum ?? null, input.end_datum ?? null, stayId)
      .run()
    await deriveAndPersistVacationDates(db, input.urlaub_id)
  }

  try {
    await db
      .prepare(
        `UPDATE urlaub_campingplaetze SET
          buchung_abreise_extra_tag = ?,
          buchung_end_datum = ?
         WHERE id = ?`
      )
      .bind(
        input.buchung_abreise_extra_tag ? 1 : 0,
        input.buchung_abreise_extra_tag ? input.buchung_end_datum ?? null : null,
        stayId
      )
      .run()
  } catch {
    // Migration 0053 noch nicht angewendet
  }

  await updateCampingStayBooking(db, stayId, bookingToSave)

  const parsed: ParsedBookingFields | null = pending.parsed_fields_json
    ? (JSON.parse(pending.parsed_fields_json) as ParsedBookingFields)
    : null
  const emailTyp =
    input.email_typ ?? parsed?.email_typ ?? 'buchungsbestaetigung'

  const gmailLink =
    buildGmailSearchLink({
      messageId: pending.message_id,
      betreff: pending.betreff,
      absender: pending.absender,
    }) ?? null

  await insertStayEmail(db, {
    stay_id: stayId,
    email_typ: emailTyp,
    betreff: pending.betreff,
    absender: pending.absender,
    empfangen_am: pending.empfangen_am,
    gmail_suchlink: gmailLink,
    inhalt_text: pending.inhalt_text,
    import_pending_id: pending.id,
  })

  await db
    .prepare(
      `UPDATE booking_import_pending SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`
    )
    .bind(pending.id)
    .run()

  return { stay_id: stayId }
}

export async function setCampingplaetzeForVacationPreservingBooking(
  db: D1Database,
  vacationId: string,
  stays: (CampingStayInput & { id?: string | null })[]
): Promise<boolean> {
  try {
    const existing = await getCampingStaysForVacation(db, vacationId)
    const byId = new Map(existing.map((s) => [s.id, s]))
    const keptIds = new Set<string>()

    for (let index = 0; index < stays.length; index++) {
      const stay = stays[index]
      if (!stay?.campingplatz_id) continue

      const existingStay = stay.id ? byId.get(stay.id) : undefined
      if (existingStay && stay.id) {
        keptIds.add(stay.id)
        await db
          .prepare(
            `UPDATE urlaub_campingplaetze SET
              campingplatz_id = ?, start_datum = ?, end_datum = ?, notizen = ?, sort_index = ?
             WHERE id = ? AND urlaub_id = ?`
          )
          .bind(
            stay.campingplatz_id,
            stay.start_datum || null,
            stay.end_datum || null,
            stay.notizen ?? existingStay.notizen ?? null,
            index,
            stay.id,
            vacationId
          )
          .run()
      } else {
        const newId = crypto.randomUUID()
        keptIds.add(newId)
        await db
          .prepare(
            `INSERT INTO urlaub_campingplaetze (
              id, urlaub_id, campingplatz_id, start_datum, end_datum, notizen, sort_index
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            vacationId,
            stay.campingplatz_id,
            stay.start_datum || null,
            stay.end_datum || null,
            stay.notizen || null,
            index
          )
          .run()
      }
    }

    if (keptIds.size > 0) {
      const placeholders = [...keptIds].map(() => '?').join(',')
      await db
        .prepare(
          `DELETE FROM urlaub_campingplaetze WHERE urlaub_id = ? AND id NOT IN (${placeholders})`
        )
        .bind(vacationId, ...keptIds)
        .run()
    } else {
      await db
        .prepare('DELETE FROM urlaub_campingplaetze WHERE urlaub_id = ?')
        .bind(vacationId)
        .run()
    }

    await deriveAndPersistVacationDates(db, vacationId)
    return true
  } catch (error) {
    console.error('Error setting camping stays preserving booking:', error)
    return false
  }
}
