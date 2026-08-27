/**
 * Gmail-Deep-Link zur Original-Mail (Suche nach Message-ID oder Metadaten).
 */
export function buildGmailSearchLink(opts: {
  messageId?: string | null
  betreff?: string | null
  absender?: string | null
}): string | null {
  const base = 'https://mail.google.com/mail/u/0/#search/'
  if (opts.messageId) {
    const id = opts.messageId.replace(/^<|>$/g, '').trim()
    if (id) {
      return `${base}${encodeURIComponent(`rfc822msgid:${id}`)}`
    }
  }
  const parts: string[] = []
  if (opts.betreff) {
    const subj = opts.betreff.replace(/^(?:Fwd|FW|Wg|Aw):\s*/i, '').trim()
    if (subj) parts.push(`subject:(${subj.slice(0, 80)})`)
  }
  if (opts.absender) {
    const from = opts.absender.match(/<([^>]+)>/)?.[1] ?? opts.absender
    if (from.includes('@')) parts.push(`from:(${from})`)
  }
  if (parts.length === 0) return null
  return `${base}${encodeURIComponent(parts.join(' '))}`
}

function extractGmailSearchQuery(webUrl: string): string | null {
  const match = webUrl.match(/#search\/(.+)$/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/**
 * Auf Smartphones Gmail-App bevorzugt öffnen (Android Intent / iOS URL-Scheme).
 * Auf Desktop bleibt der normale Web-Link unverändert.
 */
export function buildGmailMobileHref(
  webUrl: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const query = extractGmailSearchQuery(webUrl)
  if (!query) return webUrl

  if (/Android/i.test(userAgent)) {
    const fallback = encodeURIComponent(webUrl)
    return `intent://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.google.android.gm;S.browser_fallback_url=${fallback};end`
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return `googlegmail:///search?query=${encodeURIComponent(query)}`
  }

  return webUrl
}
