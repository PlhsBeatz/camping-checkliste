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
 * Android: Gmail-App über verifizierte App Links.
 *
 * mail.google.com → com.google.android.gm (assetlinks.json).
 *
 * - `#search/…` steht absichtlich VOR `#Intent;` (parseUri sucht nur `#Intent;`).
 * - Kein `S.browser_fallback_url` auf mail.google.com: sonst öffnet Chrome bei
 *   jedem Fehlschlag den internen Browser statt die App.
 * - `googlegmail://` ist auf Android meist nicht BROWSABLE → wirkungslos.
 */
export function buildAndroidGmailAppHref(query: string): string {
  const encodedQuery = encodeURIComponent(query)
  return (
    `intent://mail.google.com/mail/u/0/#search/${encodedQuery}` +
    `#Intent;scheme=https;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=com.google.android.gm;end`
  )
}

/** Android: Gmail-Inbox in der App (ohne Suche). */
export function buildAndroidGmailLaunchHref(): string {
  return (
    `intent://mail.google.com/mail/u/0/` +
    `#Intent;scheme=https;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=com.google.android.gm;end`
  )
}

/**
 * Harter Fallback: mailto ist bei Gmail zuverlässig BROWSABLE und öffnet die
 * native App (Compose). Nutzer kann zurück zur Inbox und Suche einfügen.
 */
export function buildAndroidGmailMailtoForceHref(): string {
  return (
    `intent:#Intent;action=android.intent.action.SENDTO;` +
    `scheme=mailto;package=com.google.android.gm;end`
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

/** Intent-URL synchron navigieren (User-Gesture bleibt erhalten). */
export function navigateToIntentUrl(intentUrl: string): void {
  const a = document.createElement('a')
  a.href = intentUrl
  a.rel = 'noopener'
  // Kein target=_blank – sonst Custom Tab / interner Browser
  document.body.appendChild(a)
  a.click()
  a.remove()
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
