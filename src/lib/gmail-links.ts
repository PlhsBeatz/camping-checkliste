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
      // in:anywhere: auch Spam/Papierkorb (wichtig nach Auto-Weiterleitung)
      return `${base}${encodeURIComponent(`rfc822msgid:${id} in:anywhere`)}`
    }
  }
  const parts: string[] = ['in:anywhere']
  if (opts.betreff) {
    const subj = opts.betreff.replace(/^(?:Fwd|FW|Wg|Aw):\s*/i, '').trim()
    if (subj) parts.push(`subject:(${subj.slice(0, 80)})`)
  }
  if (opts.absender) {
    const from = opts.absender.match(/<([^>]+)>/)?.[1] ?? opts.absender
    if (from.includes('@')) parts.push(`from:(${from})`)
  }
  if (parts.length <= 1) return null
  return `${base}${encodeURIComponent(parts.join(' '))}`
}

/** Suchquery aus einem Desktop-Gmail-#search/-Link extrahieren. */
export function extractGmailSearchQuery(webUrl: string): string | null {
  const hashMatch = webUrl.match(/#search\/(.+)$/)
  if (!hashMatch?.[1]) return null
  try {
    return decodeURIComponent(hashMatch[1])
  } catch {
    return hashMatch[1]
  }
}

export function isMobileGmailUserAgent(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}

/**
 * Ziel-URL für die Gmail-Websuche.
 * q= zusätzlich zum #search/-Hash: Mobile Redirects/Custom Tabs verlieren oft
 * nur das Fragment – der Query-Parameter bleibt.
 */
export function buildGmailBrowserSearchUrl(query: string): string {
  const enc = encodeURIComponent(query)
  return `https://mail.google.com/mail/u/0/?fs=1&q=${enc}#search/${enc}`
}

/**
 * Mobil: Zwischenseite in unserer App (clientseitiger Redirect), damit
 * #search nicht schon beim ersten Navigation-Hop verloren geht.
 * Desktop: unveränderter Web-Link.
 */
export function buildGmailOpenHref(
  webUrl: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const query = extractGmailSearchQuery(webUrl)
  if (!query) return webUrl

  if (isMobileGmailUserAgent(userAgent)) {
    return `/gmail-suche?q=${encodeURIComponent(query)}`
  }

  return webUrl
}
