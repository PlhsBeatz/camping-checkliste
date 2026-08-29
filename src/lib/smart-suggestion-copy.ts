/**
 * Transparente Texte für smarte Vorschläge (Inbox).
 */
import { isRejectedPlatzplanUrl } from '@/lib/platzplan-url'
import { formatSeasonBuckets, isSeasonBucket } from '@/lib/packing-season-tags'
import type { SmartSuggestion } from '@/lib/smart-suggestions'

const GENERIC_PLATZPLAN_ANCHORS = new Set([
  'link',
  'embed',
  'sitemap',
  'nav',
  'vorschlag',
])

export function displayBegruendung(s: SmartSuggestion): string {
  const raw = s.begruendung ?? ''
  return raw
    .replace(/\buebergang\b/gi, 'Übergang')
    .replace(/\bsommer\b/g, 'Sommer')
    .replace(/\bwinter\b/g, 'Winter')
}

export function packingTargetVacation(s: SmartSuggestion): string | null {
  if (s.kind !== 'packing_add' && s.kind !== 'packing_copack') return null
  const titel = String(s.payload.vacation_titel ?? '').trim()
  if (titel) return titel
  if (s.kontext_id || s.payload.vacation_id) return 'Aktueller bzw. nächster Urlaub'
  return null
}

export function acceptButtonLabel(s: SmartSuggestion): string {
  if (s.kind === 'packing_add' || s.kind === 'packing_copack') return 'Auf die Packliste'
  if (s.kind === 'platzplan') return 'Platzplan speichern'
  if (s.kind === 'place_update') return 'Prüfen'
  if (s.kind === 'xor_candidate') return 'Als Alternative speichern'
  return 'Übernehmen'
}

export function acceptConsequence(s: SmartSuggestion): string {
  if (s.kind === 'packing_add' || s.kind === 'packing_copack') {
    const was = String(s.payload.was ?? '').trim() || 'den Gegenstand'
    const vacation = packingTargetVacation(s)
    if (!vacation) {
      return `„${was}“ kann gerade nicht auf eine Packliste, weil kein Urlaub zugeordnet ist.`
    }
    return `Wie beim Packlisten-Generator: Zuordnung und Menge kommen aus der Ausrüstung, nicht aus dem gerade gewählten Packprofil. Die Ausrüstung selbst bleibt unverändert.`
  }
  if (s.kind === 'temp_promote') {
    const was = String(s.payload.was ?? 'den Eintrag')
    return `Übernehmen merkt den Vorschlag als erledigt. „${was}“ wird noch nicht automatisch in die Ausrüstung übernommen – das geht weiter über Ausrüstung → Neu.`
  }
  if (s.kind === 'xor_candidate') {
    const names = Array.isArray(s.payload.names) ? s.payload.names.map(String) : []
    const rawOptions = s.payload.options
    const hasBundle =
      Array.isArray(rawOptions) &&
      rawOptions.some((o) => {
        if (!o || typeof o !== 'object') return false
        const ids = (o as { gegenstand_ids?: unknown; ids?: unknown }).gegenstand_ids ??
          (o as { ids?: unknown }).ids
        return Array.isArray(ids) && ids.length > 1
      })
    const pair =
      names.length >= 2 ? `„${names[0]}“ oder „${names[1]}“` : 'die beiden Seiten'
    if (hasBundle) {
      return `Speichert ${pair} als Entweder-oder in der Ausrüstung. Die zweite Seite kann mehrere Teile umfassen, die zusammen gehören (z. B. Sofa und Hocker). Beim Packen erscheint ein Hinweis, wenn Gegenstände aus beiden Seiten auf der Liste stehen – nicht, wenn nur die zusammengehörigen Teile drauf sind.`
    }
    return `Speichert ${pair} als Entweder-oder-Gruppe in der Ausrüstung. Beim Packen erscheint ein Hinweis, wenn beide gleichzeitig auf der Liste stehen. Es wird nichts von der Packliste entfernt oder hinzugefügt.`
  }
  if (s.kind === 'platzplan') {
    return 'Speichert die gewählte URL als Platzplan am Campingplatz. Vorher kannst du den Link prüfen.'
  }
  if (s.kind === 'place_update') {
    return 'Öffnet den Campingplatz zum Prüfen. Geänderte Felder sind hervorgehoben; der alte Wert steht hinter dem Verlauf-Symbol. Speichern übernimmt deine Auswahl, Verwerfen ändert nichts.'
  }
  return 'Übernehmen markiert den Vorschlag als erledigt.'
}

export function packingAddSeasonHint(s: SmartSuggestion): string | null {
  const seasons = Array.isArray(s.payload.seasons) ? s.payload.seasons.map(String) : []
  const known = seasons.filter(isSeasonBucket)
  if (known.length === 0) return null
  return `Saison: ${formatSeasonBuckets(known)}`
}

export function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
    if (last && !/^(index|default)\.(html?|php|aspx?)$/i.test(last)) {
      return last.replace(/\+/g, ' ')
    }
    return u.hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

function isGenericPlatzplanAnchor(value: string): boolean {
  const a = value.trim().toLowerCase()
  if (!a || a.length < 2) return true
  if (GENERIC_PLATZPLAN_ANCHORS.has(a)) return true
  if (/^https?:\/\//i.test(a)) return true
  return false
}

export function platzplanDisplayLabel(
  url: string,
  opts?: { title?: string; anchor?: string }
): string {
  const title = opts?.title?.trim() ?? ''
  if (title && !isGenericPlatzplanAnchor(title)) return title
  const anchor = opts?.anchor?.trim() ?? ''
  if (anchor && !isGenericPlatzplanAnchor(anchor)) return anchor
  return filenameFromUrl(url)
}

export type PlatzplanChoice = {
  url: string
  label: string
  isRecommended: boolean
}

export function platzplanChoices(s: SmartSuggestion): PlatzplanChoice[] {
  if (s.kind !== 'platzplan') return []
  const primary = String(s.payload.url ?? '').trim()
  const out: PlatzplanChoice[] = []
  const seen = new Set<string>()
  const add = (url: string, label: string, isRecommended: boolean) => {
    if (!url || seen.has(url) || isRejectedPlatzplanUrl(url)) return
    seen.add(url)
    out.push({ url, label, isRecommended })
  }

  const raw = s.payload.candidates
  const byUrl = new Map<string, { title?: string; anchor?: string }>()
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (!c || typeof c !== 'object') continue
      const rec = c as { url?: unknown; anchor?: unknown; title?: unknown }
      const url = String(rec.url ?? '').trim()
      if (!url) continue
      byUrl.set(url, {
        title: String(rec.title ?? '').trim() || undefined,
        anchor: String(rec.anchor ?? '').trim() || undefined,
      })
    }
  }

  if (primary) {
    const meta = byUrl.get(primary)
    add(primary, platzplanDisplayLabel(primary, meta), true)
  }
  for (const [url, meta] of byUrl) {
    add(url, platzplanDisplayLabel(url, meta), url === primary)
  }
  if (out.length > 0 && !out.some((c) => c.isRecommended)) {
    out[0].isRecommended = true
  }
  return out
}
