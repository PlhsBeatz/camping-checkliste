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

export function isAndroidUserAgent(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): boolean {
  return /Android/i.test(userAgent)
}

export function isAppleMobileUserAgent(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent)
}

/**
 * Android: Gmail-App über Custom-Scheme (BROWSABLE), inkl. Suchquery.
 *
 * Nicht android.intent.action.SEARCH verwenden – die Activity ist aus Chrome/PWA
 * nicht BROWSABLE. Chrome fällt dann immer auf S.browser_fallback_url zurück
 * (= interner Browser), und die #search-Fragmente gehen bei Redirects verloren.
 */
export function buildAndroidGmailAppHref(query: string): string {
  const encodedQuery = encodeURIComponent(query)
  // Inbox als Fallback (nicht #search-Web-URL – Fragment geht mobil oft verloren)
  const fallback = encodeURIComponent('https://mail.google.com/mail/u/0/')
  return (
    `intent://search?q=${encodedQuery}#Intent;` +
    `scheme=googlegmail;` +
    `package=com.google.android.gm;` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  )
}

/** Android: Gmail-App ohne Suche öffnen (wenn /search nicht verstanden wird). */
export function buildAndroidGmailLaunchHref(): string {
  const fallback = encodeURIComponent('https://mail.google.com/mail/u/0/')
  return (
    `intent://#Intent;` +
    `scheme=googlegmail;` +
    `package=com.google.android.gm;` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  )
}

export function buildIosGmailAppHref(query: string): string {
  return `googlegmail:///search?q=${encodeURIComponent(query)}`
}

/**
 * Href für den <a>-Tag: Desktop = Web-Link, iOS/Android = App-Deep-Link.
 */
export function buildGmailMobileHref(
  webUrl: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const query = extractGmailSearchQuery(webUrl)
  if (!query) return webUrl

  if (isAndroidUserAgent(userAgent)) {
    return buildAndroidGmailAppHref(query)
  }

  if (isAppleMobileUserAgent(userAgent)) {
    return buildIosGmailAppHref(query)
  }

  return webUrl
}

export async function copyGmailSearchQuery(query: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(query)
      return true
    }
  } catch {
    // Fallback unten
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = query
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
