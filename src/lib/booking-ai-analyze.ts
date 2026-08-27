import type { ParsedBookingFields, Buchungsstatus, CampingStayEmailTyp } from './booking-types'
import type { ExtractedBookingPdf } from './booking-email-pdf'
import { getVacations, getCampingStaysForVacation } from './db'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'openai/gpt-4o-mini'

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
  pdfTexts: ExtractedBookingPdf[]
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
  const pdfBlock =
    input.pdfTexts.length === 0
      ? '(Keine relevanten PDF-Anhänge)'
      : input.pdfTexts
          .map(
            (p, i) =>
              `--- PDF ${i + 1}: ${p.filename} ---\n${p.text}`
          )
          .join('\n\n')

  return [
    'Extrahiere Buchungsdaten für einen Camping-Aufenthalt.',
    '',
    `Betreff: ${input.betreff || '(leer)'}`,
    '',
    'E-Mail-Text:',
    input.emailText || '(leer)',
    '',
    'PDF-Inhalte (bereits ohne AGB/Widerruf gefiltert):',
    pdfBlock,
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

const SYSTEM_PROMPT = `Du extrahierst strukturierte Buchungsdaten aus deutschen Camping-E-Mails und PDFs.
Antworte ausschließlich mit einem JSON-Objekt (kein Markdown, kein Fließtext).
Datumsformat: YYYY-MM-DD. Unbekannte Felder: null.
email_typ: reservierungsbestaetigung | buchungsbestaetigung | zahlungsbestaetigung | vor_anreise | stornierung | sonstiges
buchungsstatus: angefragt | gebucht | bezahlt | storniert | null
Nutze den Betreff und alle PDFs. Bei widersprüchlichen Angaben bevorzuge das Buchungs-PDF.`

export async function analyzeBookingWithOpenRouter(
  apiKey: string,
  input: BookingAiAnalyzeInput
): Promise<ParsedBookingFields> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/PlhsBeatz/camping-checkliste',
      'X-Title': 'Camping Packliste Buchungsimport',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Leere KI-Antwort')

  let json: Record<string, unknown>
  try {
    json = JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error('KI-Antwort ist kein gültiges JSON')
  }

  return normalizeAiParsed(json)
}

/** Kompakte Aufenthalts-Liste für den KI-Prompt. */
export async function buildBookingAiStayContext(db: D1Database): Promise<string> {
  const vacations = await getVacations(db)
  const lines: string[] = []

  for (const v of vacations.slice(0, 25)) {
    const stays = await getCampingStaysForVacation(db, v.id)
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
