/**
 * PDF-Anhänge aus E-Mails extrahieren, Allgemein-PDFs filtern, für OpenRouter vorbereiten.
 */

export type ExtractedBookingPdf = {
  filename: string
  base64: string
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

/** Grobe Textvorschau aus PDF-Rohbytes (ohne Parser) für AGB-Filter. */
function pdfPreviewText(bytes: Uint8Array): string {
  const slice = bytes.slice(0, Math.min(bytes.length, 120_000))
  return new TextDecoder('latin1').decode(slice)
}

function isGenericPdf(filename: string, bytes: Uint8Array): boolean {
  const fn = filename.toLowerCase()
  if (GENERIC_FILENAME_RE.test(fn)) return true

  const preview = pdfPreviewText(bytes)
  if (GENERIC_CONTENT_RE.test(preview) && !BOOKING_CONTENT_RE.test(preview)) return true
  if (/widerrufsrecht/i.test(preview) && !BOOKING_CONTENT_RE.test(preview)) return true

  return false
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
 * Liest PDF-Anhänge aus Roh-.eml, filtert AGB/Widerruf o.ä., liefert Base64 für OpenRouter.
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

      if (bytes.byteLength < 400) {
        skipped.push({ filename, reason: 'Datei zu klein' })
        continue
      }

      if (isGenericPdf(filename, bytes)) {
        skipped.push({ filename, reason: 'Allgemeine Unterlage (AGB/Widerruf o.ä.)' })
        continue
      }

      included.push({
        filename,
        base64: bytesToBase64(bytes),
      })
    }
  } catch (error) {
    console.error('PDF extract from eml failed:', error)
  }

  return { included, skipped }
}
