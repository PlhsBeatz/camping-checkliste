import type { ParsedBookingFields, Buchungsstatus, CampingStayEmailTyp } from './booking-types'
import type { ExtractedBookingPdf } from './booking-email-pdf'
import { enrichParsedBookingAmounts } from './booking-amount-extract'
import { getVacations, getCampingStaysForVacations } from './db'
import {
  chatJson,
  OPENROUTER_DEFAULT_MODEL,
  type OpenRouterContentPart,
} from './ai/openrouter-client'

const MODEL = OPENROUTER_DEFAULT_MODEL

const EMAIL_TYP_VALUES: CampingStayEmailTyp[] = [
  'reservierungsbestaetigung',
  'buchungsbestaetigung',
  'zahlungsbestaetigung',
  'vor_anreise',
  'stornierung',
  'sonstiges',
]

const BUCHUNGSSTATUS_VALUES: Buchungsstatus[] = [
  'angefragt',
  'gebucht',
  'bezahlt',
  'storniert',
]

export type BookingAiAnalyzeInput = {
  betreff: string
  emailText: string
  pdfFiles: ExtractedBookingPdf[]
  stayContext: string
}

function nullIfEmpty(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function normalizeAiParsed(raw: Record<string, unknown>): ParsedBookingFields {
  const emailTypRaw = nullIfEmpty(raw.email_typ)
  const email_typ = EMAIL_TYP_VALUES.includes(emailTypRaw as CampingStayEmailTyp)
    ? (emailTypRaw as CampingStayEmailTyp)
    : null

  const statusRaw = nullIfEmpty(raw.buchungsstatus)
  const buchungsstatus = BUCHUNGSSTATUS_VALUES.includes(statusRaw as Buchungsstatus)
    ? (statusRaw as Buchungsstatus)
    : null

  return {
    platznummer: nullIfEmpty(raw.platznummer),
    buchungsnummer: nullIfEmpty(raw.buchungsnummer),
    buchungsstatus,
    start_datum: nullIfEmpty(raw.start_datum),
    end_datum: nullIfEmpty(raw.end_datum),
    checkin_zeit: nullIfEmpty(raw.checkin_zeit),
    checkout_zeit: nullIfEmpty(raw.checkout_zeit),
    zugangscode: nullIfEmpty(raw.zugangscode),
    unterkunftstyp: nullIfEmpty(raw.unterkunftstyp),
    preis_gesamt: parseNumber(raw.preis_gesamt),
    waehrung: nullIfEmpty(raw.waehrung) ?? 'EUR',
    anzahlung_betrag: parseNumber(raw.anzahlung_betrag),
    restzahlung_faellig_am: nullIfEmpty(raw.restzahlung_faellig_am),
    buchungsdatum: nullIfEmpty(raw.buchungsdatum),
    stornierungsfrist: nullIfEmpty(raw.stornierungsfrist),
    kontakt_platz: nullIfEmpty(raw.kontakt_platz),
    campingplatz_name: nullIfEmpty(raw.campingplatz_name),
    campingplatz_ort: nullIfEmpty(raw.campingplatz_ort),
    email_typ,
  }
}

function buildUserPrompt(input: BookingAiAnalyzeInput): string {
  const pdfList =
    input.pdfFiles.length === 0
      ? '(Keine relevanten PDF-Anhänge)'
      : input.pdfFiles.map((p) => `- ${p.filename}`).join('\n')

  return [
    'Extrahiere Buchungsdaten für einen Camping-Aufenthalt.',
    '',
    `Betreff: ${input.betreff || '(leer)'}`,
    '',
    'E-Mail-Text:',
    input.emailText || '(leer)',
    '',
    'PDF-Anhänge (vollständig als Datei beigefügt, AGB/Widerruf bereits gefiltert):',
    pdfList,
    '',
    'Bekannte Urlaube und Aufenthalte in der App (zur Zuordnung von Campingplatz/Datum):',
    input.stayContext || '(keine)',
    '',
    'JSON-Felder (null wenn unbekannt):',
    'platznummer, buchungsnummer, buchungsstatus, start_datum, end_datum,',
    'checkin_zeit, checkout_zeit, zugangscode, unterkunftstyp, preis_gesamt, waehrung,',
    'anzahlung_betrag, restzahlung_faellig_am, buchungsdatum, stornierungsfrist,',
    'kontakt_platz, campingplatz_name, campingplatz_ort, email_typ',
  ].join('\n')
}

function buildUserContent(input: BookingAiAnalyzeInput): OpenRouterContentPart[] {
  const parts: OpenRouterContentPart[] = [{ type: 'text', text: buildUserPrompt(input) }]
  for (const pdf of input.pdfFiles) {
    parts.push({
      type: 'file',
      file: {
        filename: pdf.filename,
        file_data: `data:application/pdf;base64,${pdf.base64}`,
      },
    })
  }
  return parts
}

const SYSTEM_PROMPT = `Du extrahierst strukturierte Buchungsdaten aus deutschen/englischen Camping-E-Mails und PDFs.
Antworte ausschließlich mit einem JSON-Objekt (kein Markdown, kein Fließtext).
Datumsformat: YYYY-MM-DD. Unbekannte Felder: null.
email_typ: reservierungsbestaetigung | buchungsbestaetigung | zahlungsbestaetigung | vor_anreise | stornierung | sonstiges
buchungsstatus: angefragt | gebucht | bezahlt | storniert | null

WICHTIG zu Beträgen:
- preis_gesamt = Endsumme/Gesamtbetrag/Total der Buchung (z. B. „Endsumme: 352,80 €“).
- anzahlung_betrag = Anzahlung, Online-Zahlung, Deposit oder bestätigter Zahlungseingang (z. B. Tabellenzeile „Online Zahlung … -88,20“ oder Zahlungsmail „Betrag: 88,20 EUR“).
- Bei Zahlungsbestätigungen ohne Gesamtsumme: nur anzahlung_betrag setzen, preis_gesamt null lassen.
- Den Betrag aus einer reinen Zahlungsinfo-Mail NIEMALS als preis_gesamt speichern.

Nutze Betreff, E-Mail-Text und PDFs vollständig. Bei Widersprüchen bevorzuge das Buchungs-PDF für Gesamtsumme und Zeitraum.`

export async function analyzeBookingWithOpenRouter(
  apiKey: string,
  input: BookingAiAnalyzeInput
): Promise<ParsedBookingFields> {
  const result = await chatJson({
    apiKey,
    system: SYSTEM_PROMPT,
    user: buildUserContent(input),
    model: MODEL,
    temperature: 0.1,
    pdfPlugin: input.pdfFiles.length > 0,
    trigger: 'explicit',
    title: 'Camping Packliste Buchungsimport',
  })
  return enrichParsedBookingAmounts(normalizeAiParsed(result.json), {
    subject: input.betreff,
    text: input.emailText,
  })
}

/** Kompakte Aufenthalts-Liste für den KI-Prompt. */
export async function buildBookingAiStayContext(db: D1Database): Promise<string> {
  const vacations = await getVacations(db)
  const limited = vacations.slice(0, 25)
  const staysByVacation = await getCampingStaysForVacations(
    db,
    limited.map((v) => v.id)
  )
  const lines: string[] = []

  for (const v of limited) {
    const stays = staysByVacation.get(v.id) ?? []
    for (const s of stays) {
      lines.push(
        `- Urlaub „${v.titel}“: ${s.campingplatz.name}, ${s.campingplatz.ort}, ` +
          `${s.start_datum ?? '?'} bis ${s.end_datum ?? '?'}, ` +
          `Buchung ${s.buchungsnummer ?? '—'}, Platz ${s.platznummer ?? '—'}`
      )
    }
  }

  return lines.join('\n')
}
