/**
 * Leichtgewichtige Text-Extraktion aus MIME ohne Anhänge zu dekodieren.
 * Für E-Mails mit PDF-Anhängen – postal-mime würde sonst CPU-Limit (1102) sprengen.
 */

const MAX_SCAN_BYTES = 512 * 1024
/** Bis zu dieser Größe postal-mime (liefert bessere Ergebnisse bei verschachteltem MIME). */
const MAX_POSTAL_MIME_BYTES = 800 * 1024

export const BOOKING_EML_MAX_R2_BYTES = 2 * 1024 * 1024

export type ExtractedEmailBodies = {
  text: string
  html: string
  usedPostalMime: boolean
}

function decodeBase64Chunk(input: string): string {
  try {
    const cleaned = input.replace(/\s/g, '')
    if (!cleaned) return ''
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return ''
  }
}

function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const ch = withoutSoftBreaks[i]
    if (ch === '=' && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 2
        continue
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i))
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
}

function bytesToLatin1(raw: ArrayBuffer, maxBytes: number): string {
  const len = Math.min(raw.byteLength, maxBytes)
  const view = new Uint8Array(raw, 0, len)
  let out = ''
  for (let i = 0; i < view.length; i++) out += String.fromCharCode(view[i]!)
  return out
}

function parseHeaders(block: string) {
  const lines = block.replace(/\r\n/g, '\n').split('\n')
  let contentType: string | null = null
  let transferEncoding: string | null = null
  let boundary: string | null = null

  for (const line of lines) {
    const ct = line.match(/^Content-Type:\s*([^;\n]+)(?:;\s*(.*))?/i)
    if (ct?.[1]) {
      contentType = ct[1].trim().toLowerCase()
      const rest = ct[2] ?? ''
      const b = rest.match(/boundary="?([^"\s;]+)"?/i)
      if (b?.[1]) boundary = b[1]
    }
    const te = line.match(/^Content-Transfer-Encoding:\s*(.+)/i)
    if (te?.[1]) transferEncoding = te[1].trim().toLowerCase()
  }

  return { contentType, transferEncoding, boundary }
}

function decodePartBody(body: string, transferEncoding: string | null): string {
  const trimmed = body.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return ''
  if (transferEncoding === 'base64') return decodeBase64Chunk(trimmed)
  if (transferEncoding === 'quoted-printable') return decodeQuotedPrintable(trimmed)
  return trimmed
}

function splitByBoundary(source: string, boundary: string): string[] {
  const marker = `--${boundary}`
  return source
    .split(marker)
    .map((p) => p.replace(/^--\s*$/, '').trim())
    .filter((p) => p && !p.startsWith('--'))
}

function extractBodiesFromMimeBlock(block: string): { texts: string[]; htmls: string[] } {
  const texts: string[] = []
  const htmls: string[] = []

  const normalized = block.replace(/\r\n/g, '\n')
  const headerBodySplit = normalized.indexOf('\n\n')
  if (headerBodySplit < 0) return { texts, htmls }

  const headerBlock = normalized.slice(0, headerBodySplit)
  const body = normalized.slice(headerBodySplit + 2)
  const headers = parseHeaders(headerBlock)
  const type = headers.contentType ?? 'text/plain'

  if (type.startsWith('multipart/') && headers.boundary) {
    for (const part of splitByBoundary(body, headers.boundary)) {
      const nested = extractBodiesFromMimeBlock(part)
      texts.push(...nested.texts)
      htmls.push(...nested.htmls)
    }
    return { texts, htmls }
  }

  if (type === 'message/rfc822') {
    const nested = extractBodiesFromMimeBlock(body)
    texts.push(...nested.texts)
    htmls.push(...nested.htmls)
    return { texts, htmls }
  }

  if (type.startsWith('application/') || type.startsWith('image/')) {
    return { texts, htmls }
  }

  const decoded = decodePartBody(body, headers.transferEncoding)
  if (!decoded) return { texts, htmls }

  if (type.includes('text/html')) htmls.push(decoded)
  else if (type.includes('text/plain') || type.startsWith('text/')) texts.push(decoded)

  return { texts, htmls }
}

function pickBestPart(parts: string[]): string {
  if (parts.length === 0) return ''
  return parts.sort((a, b) => b.length - a.length)[0] ?? ''
}

function walkRawMime(source: string): { text: string; html: string } {
  const { texts, htmls } = extractBodiesFromMimeBlock(source)
  return {
    text: pickBestPart(texts),
    html: pickBestPart(htmls),
  }
}

/**
 * Extrahiert Text/HTML aus Roh-MIME. Kleine/mittlere Mails via postal-mime, große per Boundary-Walk.
 */
export async function extractEmailBodies(
  rawBuffer: ArrayBuffer,
  fallbackSubject: string
): Promise<ExtractedEmailBodies> {
  if (rawBuffer.byteLength <= MAX_POSTAL_MIME_BYTES) {
    try {
      const PostalMime = (await import('postal-mime')).default
      const parsed = await PostalMime.parse(rawBuffer, {
        maxNestingDepth: 48,
        maxRfc822NestingDepth: 3,
      })
      const text = parsed.text ?? ''
      const html = parsed.html ?? ''
      if (text.trim() || html.trim()) {
        return { text, html, usedPostalMime: true }
      }
    } catch {
      // Fallback unten
    }
  }

  const scanned = bytesToLatin1(rawBuffer, MAX_SCAN_BYTES)
  const walked = walkRawMime(scanned)

  if (!walked.text && !walked.html && fallbackSubject) {
    return { text: `[Betreff: ${fallbackSubject}]`, html: '', usedPostalMime: false }
  }

  return { ...walked, usedPostalMime: false }
}
