import type { ParsedBookingFields, CampingStayEmailTyp } from './booking-types'
import { decodeMimeHeaderValue } from './booking-email-headers'

const FWD_PREFIX = /^(?:Fwd|FW|Wg|Aw):\s*/i

const FWD_MARKERS = [
  /---------- Forwarded message ---------/i,
  /-------- Weitergeleitete Nachricht --------/i,
  /Begin forwarded message:/i,
  /Anfang der weitergeleiteten Nachricht:/i,
]

/** Bereitet E-Mail-Text für Parsing vor (Weiterleitung, HTML, Betreff). */
export function prepareBookingText(body: string, subject: string): string {
  let text = body.replace(/\r\n/g, '\n').trim()
  if (!text && subject) text = ''

  for (const marker of FWD_MARKERS) {
    const idx = text.search(marker)
    if (idx >= 0) {
      const after = text.slice(idx)
      const originalStart = after.search(
        /\n(?:From|Von|Betreff|Subject|Datum|Date):[^\n]+\n(?:[^\n]+\n){0,6}/i
      )
      if (originalStart >= 0) {
        text = after.slice(originalStart + 1)
      } else {
        text = after.replace(marker, '').trim()
      }
      break
    }
  }

  text = text.replace(/^>+\s?/gm, '')

  const cleanSubj = cleanSubject(subject)
  if (cleanSubj) {
    return `${text}\n\nBetreff: ${cleanSubj}`.trim()
  }
  return text
}

/** Entfernt HTML-Tags grob für Plaintext-Parsing. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanSubject(subject: string): string {
  const decoded = decodeMimeHeaderValue(subject)
  return decoded.replace(FWD_PREFIX, '').trim()
}

/** Buchungs-/Reservierungsnummer oft nur im Betreff (z. B. „Reservierungsbestätigung - 12613500“). */
function parseBookingNumberFromSubject(cleanSubj: string): string | null {
  if (!cleanSubj) return null
  const patterns = [
    /(?:Reservierungs(?:bestätigung|bestaetigung)|Buchungs(?:bestätigung|bestaetigung)|Bestätigung|Confirmation|Booking)\s*[-–—]\s*(\d{4,})/i,
    /[-–—]\s*(\d{5,})\s*$/,
    /\bNr\.?\s*(\d{5,})\b/i,
  ]
  for (const re of patterns) {
    const m = cleanSubj.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function parseGermanDate(text: string): string | null {
  const m = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/)
  if (!m?.[1] || !m[2] || !m[3]) return null
  const day = m[1].padStart(2, '0')
  const month = m[2].padStart(2, '0')
  let year = m[3]
  if (year.length === 2) year = `20${year}`
  const iso = `${year}-${month}-${day}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return iso
}

function parseDateRange(text: string): { start: string | null; end: string | null } {
  const patterns: RegExp[] = [
    /(?:Anreise|Von|From|Check-?in|Reisezeitraum)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})[^\d\n]{0,40}(?:Abreise|Bis|To|Check-?out)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /(?:vom|from)\s+(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*(?:bis|to|–|-)\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
    /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*(?:–|-|bis)\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1] && m[2]) {
      return { start: parseGermanDate(m[1]), end: parseGermanDate(m[2]) }
    }
  }

  const anreise = text.match(/(?:Anreise|Check-?in)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i)
  const abreise = text.match(/(?:Abreise|Check-?out)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i)
  return {
    start: anreise?.[1] ? parseGermanDate(anreise[1]) : null,
    end: abreise?.[1] ? parseGermanDate(abreise[1]) : null,
  }
}

function parseAmount(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*(?:€|EUR)?/i)
  if (!m?.[1]) return null
  const normalized = m[1].replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function inferEmailTyp(subject: string, body: string): CampingStayEmailTyp {
  const combined = `${subject} ${body}`.toLowerCase()
  if (/storno|stornierung|cancel/i.test(combined)) return 'stornierung'
  if (/zahlung|bezahlt|payment|rechnung/i.test(combined)) return 'zahlungsbestaetigung'
  if (/anreise|check-?in|vor der anreise|torcode|zugang/i.test(combined))
    return 'vor_anreise'
  if (
    /reservierungsbestätigung|reservierungsbestaetigung|reservation confirmation|unverbindlich/i.test(
      combined
    )
  )
    return 'reservierungsbestaetigung'
  if (/reservierung/i.test(combined) && !/buchungsbestätigung|booking confirmation/i.test(combined))
    return 'reservierungsbestaetigung'
  if (/buchungsbestätigung|booking confirmation|zahlungseingang/i.test(combined))
    return 'buchungsbestaetigung'
  if (/buchung|bestätigung|confirmation|booking/i.test(combined))
    return 'buchungsbestaetigung'
  return 'sonstiges'
}

/** Vereinigt gespeicherte und neu geparste Felder (neue Werte haben Vorrang wenn gesetzt). */
export function mergeParsedFields(
  stored: ParsedBookingFields | null,
  fresh: ParsedBookingFields
): ParsedBookingFields {
  if (!stored) return fresh
  const out: ParsedBookingFields = { ...stored }
  for (const [key, value] of Object.entries(fresh) as [keyof ParsedBookingFields, unknown][]) {
    if (value != null && value !== '') {
      ;(out as Record<string, unknown>)[key as string] = value
    }
  }
  return out
}

/**
 * Regelbasiertes Parsing deutscher Camping-Buchungsmails.
 */
export function parseBookingEmail(
  body: string,
  subject: string
): ParsedBookingFields {
  const cleanSubj = cleanSubject(subject)
  const text = prepareBookingText(body, subject)
  const combined = `${cleanSubj}\n${text}`

  const platznummer = firstMatch(combined, [
    /(?:Stell)?platz(?:nummer)?[:\s#]*([A-Za-z0-9\-/]+)/i,
    /(?:Pitch|Platz)\s*(?:Nr\.?|#)[:\s]*([A-Za-z0-9\-/]+)/i,
    /Platz\s+([A-Za-z0-9\-/]{1,12})\b/i,
    /(?:Stellplatz|Standplatz)\s+([A-Za-z0-9\-/]{1,12})\b/i,
  ])

  const buchungsnummer =
    firstMatch(combined, [
      /(?:Buchungs(?:nummer|nr\.?)|Reservierungs(?:nummer|nr\.?)|Booking(?:\s*ID|\s*Nr\.?)|Bestell(?:nummer|nr\.?)|Auftrags(?:nummer|nr\.?))[:\s#]*([A-Za-z0-9\-/]+)/i,
      /(?:Referenz|Vorgang|Confirmation(?:\s*No\.?)?)[:\s#]*([A-Za-z0-9\-/]+)/i,
      /(?:Nr\.|No\.|#)\s*([A-Z0-9]{5,20})\b/,
    ]) ?? parseBookingNumberFromSubject(cleanSubj)

  const checkin_zeit = firstMatch(text, [
    /Check-?in[:\s]*([0-9]{1,2}[:.][0-9]{2}\s*(?:Uhr)?(?:\s*[-–]\s*[0-9]{1,2}[:.][0-9]{2}\s*(?:Uhr)?)?)/i,
    /Anreise(?:zeit)?[:\s]*([0-9]{1,2}[:.][0-9]{2}[^,\n]*)/i,
  ])

  const checkout_zeit = firstMatch(text, [
    /Check-?out[:\s]*([0-9]{1,2}[:.][0-9]{2}\s*(?:Uhr)?(?:\s*[-–]\s*[0-9]{1,2}[:.][0-9]{2}\s*(?:Uhr)?)?)/i,
    /Abreise(?:zeit)?[:\s]*([0-9]{1,2}[:.][0-9]{2}[^,\n]*)/i,
  ])

  const zugangscode = firstMatch(text, [
    /(?:Tor(?:code)?|Zugangscode|PIN|Code)[:\s#]*([A-Za-z0-9\-#]+)/i,
  ])

  const unterkunftstyp = firstMatch(text, [
    /(?:Unterkunft|Stellplatz(?:typ)?|Platztyp)[:\s]*([^\n,]{3,40})/i,
  ])

  const kontakt_platz = firstMatch(text, [
    /(?:Tel(?:efon)?|Telefonnummer)[:\s]*([+\d\s()/\-]{8,24})/i,
    /(?:E-?Mail)[:\s]*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
  ])

  let start_datum: string | null = null
  let end_datum: string | null = null

  const range = parseDateRange(combined)
  start_datum = range.start
  end_datum = range.end

  const campingplatz_name =
    firstMatch(combined, [
      /(?:Camping(?:platz)?|Stellplatz)[:\s]*([^\n,]{3,60})/i,
    ]) ??
    firstMatch(cleanSubj, [
      /(?:Camping(?:platz)?|Stellplatz)\s+([^\-|–]{3,60})/i,
      /^([A-ZÄÖÜ][^\n–-]{3,50}?)(?:\s*[-–|]\s*(?:Buchung|Reservierung|Booking))/i,
    ])

  const preis_gesamt =
    parseAmount(
      firstMatch(text, [
        /(?:Gesamt(?:preis|betrag)|Summe|Total)[:\s]*([^\n]+)/i,
      ]) ?? ''
    ) ?? parseAmount(text)

  const anzahlung_betrag = parseAmount(
    firstMatch(text, [
      /(?:Anzahlung)[:\s]*([^\n]+)/i,
    ]) ?? ''
  )

  const restzahlungMatch = text.match(
    /Restzahlung[^0-9]{0,30}(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i
  )
  const restzahlung_faellig_am = restzahlungMatch?.[1]
    ? parseGermanDate(restzahlungMatch[1])
    : null

  const buchungsdatumMatch = text.match(
    /(?:Buchungsdatum|gebucht am)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i
  )
  const buchungsdatum = buchungsdatumMatch?.[1]
    ? parseGermanDate(buchungsdatumMatch[1])
    : null

  const stornoMatch = text.match(
    /(?:Stornierungsfrist|kostenfrei stornieren bis)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i
  )
  const stornierungsfrist = stornoMatch?.[1] ? parseGermanDate(stornoMatch[1]) : null

  const email_typ = inferEmailTyp(cleanSubj, text)

  let buchungsstatus: ParsedBookingFields['buchungsstatus'] = null
  if (/storniert|cancel/i.test(text)) buchungsstatus = 'storniert'
  else if (/bezahlt|zahlung erhalten/i.test(text)) buchungsstatus = 'bezahlt'
  else if (/bestätigt|confirmed|gebucht/i.test(text)) buchungsstatus = 'gebucht'
  else if (/anfrage|angefragt/i.test(text)) buchungsstatus = 'angefragt'

  return {
    platznummer,
    buchungsnummer,
    buchungsstatus,
    start_datum,
    end_datum,
    checkin_zeit,
    checkout_zeit,
    zugangscode,
    unterkunftstyp,
    preis_gesamt,
    waehrung: 'EUR',
    anzahlung_betrag,
    restzahlung_faellig_am,
    buchungsdatum,
    stornierungsfrist,
    kontakt_platz,
    campingplatz_name,
    email_typ,
  }
}
