/**
 * PDF-Anhänge aus E-Mails extrahieren, Allgemein-PDFs filtern, Text für KI-Analyse.
 */

export type ExtractedBookingPdf = {
  filename: string
  text: string
}

export type SkippedPdf = {
  filename: string
  reason: string
}

export type BookingPdfExtractResult = {
  included: ExtractedBookingPdf[]
  skipped: SkippedPdf[]
}

const MAX_PDF_BYTES = 4 * 1024 * 1024
/** Pro PDF – großzügig, damit mehrseitige Buchungsbestätigungen vollständig ankommen. */
const MAX_PDF_TEXT_CHARS = 80_000

const GENERIC_FILENAME_RE =
  /(?:^|[\s._-])(agb|agbs|allgemeine[\s-]?gesch|terms|conditions|widerruf|widerrufsbelehrung|datenschutz|privacy|impressum|hausordnung|information(?:sblatt)?|nutzungsbedingungen|stornobedingungen)(?:[\s._-]|$)/i

const GENERIC_CONTENT_RE =
  /(?:allgemeine\s+geschäftsbedingungen|widerrufsbelehrung|widerrufsrecht|datenschutzerklärung|datenschutzhinweis|informationen\s+zum\s+widerruf|fernabsatzgesetz)/i

const BOOKING_CONTENT_RE =
  /(?:buchung|reservierung|stellplatz|platznummer|anreise|abreise|buchungsnummer|reservierungsnummer|check-?in|übernachtung|aufenthalt|mietvertrag)/i

function attachmentToBytes(content: unknown): Uint8Array | null {
  if (content instanceof ArrayBuffer) return new Uint8Array(content)
  if (content instanceof Uint8Array) return content
  if (typeof content === 'string') {
    try {
      const binary = atob(content.replace(/\s/g, ''))
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    } catch {
      return null
    }
  }
  return null
}

function isGenericPdf(filename: string, text: string): boolean {
  const fn = filename.toLowerCase()
  if (GENERIC_FILENAME_RE.test(fn)) return true

  const preview = text.slice(0, 3000)
  if (GENERIC_CONTENT_RE.test(preview) && !BOOKING_CONTENT_RE.test(preview)) return true
  if (/widerrufsrecht/i.test(preview) && !BOOKING_CONTENT_RE.test(preview)) return true

  return false
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(data)
    const { text } = await extractText(pdf, { mergePages: true })
    return (text ?? '').replace(/\s+\n/g, '\n').trim()
  } catch {
    return ''
  }
}

async function collectPdfAttachments(parsed: {
  attachments?: Array<{
    filename?: string | null
    mimeType?: string
    content?: unknown
  }>
}): Promise<Array<{ filename: string; bytes: Uint8Array }>> {
  const out: Array<{ filename: string; bytes: Uint8Array }> = []
  for (const att of parsed.attachments ?? []) {
    const filename = att.filename?.trim() || 'anhang.pdf'
    const mime = (att.mimeType ?? '').toLowerCase()
    if (!mime.includes('pdf') && !filename.toLowerCase().endsWith('.pdf')) continue
    const bytes = attachmentToBytes(att.content)
    if (!bytes || bytes.byteLength === 0) continue
    out.push({ filename, bytes })
  }
  return out
}

/**
 * Liest PDF-Anhänge aus Roh-.eml, filtert AGB/Widerruf o.ä., extrahiert Buchungs-PDF-Text.
 */
export async function extractBookingPdfTextsFromRaw(
  raw: ArrayBuffer
): Promise<BookingPdfExtractResult> {
  const included: ExtractedBookingPdf[] = []
  const skipped: SkippedPdf[] = []

  try {
    const PostalMime = (await import('postal-mime')).default
    const parsed = await PostalMime.parse(raw, {
      maxNestingDepth: 48,
      maxRfc822NestingDepth: 3,
    })

    const pdfs = await collectPdfAttachments(parsed)

    for (const { filename, bytes } of pdfs) {
      if (bytes.byteLength > MAX_PDF_BYTES) {
        skipped.push({ filename, reason: 'PDF zu groß' })
        continue
      }

      const text = await extractPdfText(bytes)
      if (!text || text.length < 40) {
        skipped.push({ filename, reason: 'Kein lesbarer Text' })
        continue
      }

      if (isGenericPdf(filename, text)) {
        skipped.push({ filename, reason: 'Allgemeine Unterlage (AGB/Widerruf o.ä.)' })
        continue
      }

      included.push({
        filename,
        text: text.length > MAX_PDF_TEXT_CHARS ? text.slice(0, MAX_PDF_TEXT_CHARS) : text,
      })
    }
  } catch (error) {
    console.error('PDF extract from eml failed:', error)
  }

  return { included, skipped }
}
