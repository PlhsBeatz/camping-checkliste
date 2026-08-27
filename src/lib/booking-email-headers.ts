/**
 * Dekodierung von RFC 2047 encoded-word Headern (=?UTF-8?Q?...?=).
 */

const ENCODED_WORD_RE = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g

function decodeQuotedPrintableBytes(input: string): Uint8Array {
  const cleaned = input.replace(/_/g, ' ')
  const bytes: number[] = []
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 2
        continue
      }
    }
    bytes.push(cleaned.charCodeAt(i))
  }
  return new Uint8Array(bytes)
}

function decodeCharsetBytes(bytes: Uint8Array, charset: string): string {
  const cs = charset.toLowerCase()
  try {
    if (cs === 'utf-8' || cs === 'utf8') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    }
    if (cs === 'iso-8859-1' || cs === 'latin1' || cs === 'windows-1252') {
      return new TextDecoder('iso-8859-1').decode(bytes)
    }
    return new TextDecoder(cs, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

function decodeEncodedWord(charset: string, encoding: string, payload: string): string {
  if (encoding.toUpperCase() === 'B') {
    const binary = atob(payload.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return decodeCharsetBytes(bytes, charset)
  }
  return decodeCharsetBytes(decodeQuotedPrintableBytes(payload), charset)
}

/** Dekodiert MIME-Header (Betreff, Absender-Anzeigename). */
export function decodeMimeHeaderValue(value: string | null | undefined): string {
  if (!value) return ''
  const folded = value.replace(/\r?\n[ \t]+/g, ' ').trim()
  if (!folded.includes('=?')) return folded

  return folded
    .replace(ENCODED_WORD_RE, (_match, charset: string, enc: string, payload: string) =>
      decodeEncodedWord(charset, enc, payload)
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Betreff aus den ersten KB einer Roh-E-Mail (Fallback wenn Worker-Header kodiert ist). */
export function extractSubjectFromRaw(rawLatin1: string): string | null {
  const m = rawLatin1.match(/^Subject:\s*((?:[^\r\n]|\r?\n[ \t])+)/im)
  if (!m?.[1]) return null
  return decodeMimeHeaderValue(m[1].replace(/\r?\n[ \t]+/g, ' '))
}
