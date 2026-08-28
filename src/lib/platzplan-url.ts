import type { Campingplatz } from './db'

function urlPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** XML ist nie ein Platzplan (weder Bild, PDF noch interaktive Karte). */
export function isXmlPlatzplanUrl(url: string): boolean {
  return /\.xml(\.gz)?$/i.test(urlPathname(url))
}

/**
 * HTML-/XML-Sitemap im Sinne der Website-Navigation – nicht der Camping-Lageplan.
 * Trifft z. B. /de/site-map/ und /wp-sitemap-posts-post-1.xml.
 */
export function isWebsiteSitemapPath(url: string): boolean {
  if (isXmlPlatzplanUrl(url)) return true
  const path = urlPathname(url)
  const segs = path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/\.(html?|php|aspx?)$/i, ''))
  if (
    segs.some((s) =>
      /^(site-map|site_map|sitemap|sitemaps|plan-du-site|plan_du_site|plandusite|mappa-del-sito|mapa-del-sitio|html-sitemap|xml-sitemap)$/i.test(
        s
      )
    )
  ) {
    return true
  }
  if (segs.some((s) => /^(wp-sitemap|sitemap-index|sitemap_index)/i.test(s))) return true
  if (/wp-sitemap|sitemap[_-]?(index|posts?|pages?|categories|tags|news|users)/i.test(path)) {
    return true
  }
  return false
}

/** XML oder Navigations-Sitemap – darf nicht als Platzplan gespeichert werden. */
export function isRejectedPlatzplanUrl(url: string): boolean {
  return isXmlPlatzplanUrl(url) || isWebsiteSitemapPath(url)
}

/** Baut die Platzplan-URL mit optional eingesetzter Platznummer. */
export function buildPlatzplanUrl(
  campingplatz: Pick<
    Campingplatz,
    'platzplan_url' | 'platzplan_url_vorlage'
  >,
  platznummer?: string | null
): string | null {
  const num = platznummer?.trim()
  if (num && campingplatz.platzplan_url_vorlage) {
    return campingplatz.platzplan_url_vorlage.replace(/\{platznummer\}/gi, encodeURIComponent(num))
  }
  if (campingplatz.platzplan_url) return campingplatz.platzplan_url
  return null
}
