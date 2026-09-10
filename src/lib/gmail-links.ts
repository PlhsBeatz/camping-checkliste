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
 * Auf Smartphones Gmail-App bevorzugt öffnen (Android Intent / iOS URL-Scheme).
 * Auf Desktop bleibt der normale Web-Link unverändert.
 *
 * Wichtig Android: Kein `#search/…` vor `#Intent` — das erste `#` startet die
 * Intent-Parameter, die Suchquery ginge sonst verloren (Inbox ohne Filter).
 */
export function buildGmailMobileHref(
  webUrl: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const query = extractGmailSearchQuery(webUrl)
  if (!query) return webUrl

  const encodedQuery = encodeURIComponent(query)
  const fallback = encodeURIComponent(webUrl)

  if (/Android/i.test(userAgent)) {
    // SEARCH + S.query öffnet die App mit der Suche; Fallback = voller Web-Link.
    return (
      `intent:#Intent;` +
      `action=android.intent.action.SEARCH;` +
      `package=com.google.android.gm;` +
      `S.query=${encodedQuery};` +
      `S.browser_fallback_url=${fallback};` +
      `end`
    )
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    // Parameter heißt in der Gmail-iOS-App `q`, nicht `query`.
    return `googlegmail:///search?q=${encodedQuery}`
  }

  return webUrl
}
