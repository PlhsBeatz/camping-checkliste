/**
 * Leichtgewichtige Text-Extraktion aus MIME ohne Anhänge zu dekodieren.
 * Für E-Mails mit PDF-Anhängen – postal-mime würde sonst CPU-Limit (1102) sprengen.
 */

const MAX_SCAN_BYTES = 512 * 1024

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
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
}

function bytesToLatin1(raw: ArrayBuffer, maxBytes: number): string {
  const len = Math.min(raw.byteLength, maxBytes)
  const view = new Uint8Array(raw, 0, len)
  let out = ''
  for (let i = 0; i < view.length; i++) out += String.fromCharCode(view[i]!)
  return out
}

function extractMimePart(source: string, mimeType: 'text/plain' | 'text/html'): string {
  const escaped = mimeType.replace('/', '\\/')
  const partRe = new RegExp(
    `Content-Type:\\s*${escaped}(?:;[^\\n]*)?\\n([\\s\\S]*?)(?=\\n--[^\\n\\r]+|$)`,
    'i'
  )
  const match = source.match(partRe)
  if (!match?.[1]) return ''

  const block = match[0]
  let body = match[1].replace(/\r\n/g, '\n')
  const bodyStart = body.indexOf('\n\n')
  if (bodyStart >= 0) body = body.slice(bodyStart + 2)

  body = body.replace(/\n--[^\n]+[\s\S]*$/, '').trim()

  if (/Content-Transfer-Encoding:\s*base64/i.test(block)) {
    return decodeBase64Chunk(body)
  }
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(block)) {
    return decodeQuotedPrintable(body)
  }
  return body.trim()
}

export type ExtractedEmailBodies = {
  text: string
  html: string
  usedPostalMime: boolean
}

const MAX_POSTAL_MIME_BYTES = 200 * 1024

/**
 * Extrahiert Text/HTML aus Roh-MIME. Kleine Mails via postal-mime, große nur Header-Scan.
 */
export async function extractEmailBodies(
  rawBuffer: ArrayBuffer,
  fallbackSubject: string
): Promise<ExtractedEmailBodies> {
  if (rawBuffer.byteLength <= MAX_POSTAL_MIME_BYTES) {
    try {
      const PostalMime = (await import('postal-mime')).default
      const parsed = await PostalMime.parse(rawBuffer, {
        maxNestingDepth: 32,
        maxRfc822NestingDepth: 0,
      })
      return {
        text: parsed.text ?? '',
        html: parsed.html ?? '',
        usedPostalMime: true,
      }
    } catch {
      // Fallback unten
    }
  }

  const scanned = bytesToLatin1(rawBuffer, MAX_SCAN_BYTES)
  const text = extractMimePart(scanned, 'text/plain')
  const html = extractMimePart(scanned, 'text/html')

  if (!text && !html && fallbackSubject) {
    return { text: `[Betreff: ${fallbackSubject}]`, html: '', usedPostalMime: false }
  }

  return { text, html, usedPostalMime: false }
}

export const BOOKING_EML_MAX_R2_BYTES = 2 * 1024 * 1024
