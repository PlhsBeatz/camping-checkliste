import type { PackingItem, Mitreisender } from '@/lib/db'
import {
  resolveActiveGruppeIdForPacking,
  resolvePauschalHidePacked,
  passesPauschalGruppenFilter,
  type PauschalGruppenFilter,
} from '@/lib/pauschal-gruppen'

export type PacklistHideReason = 'dauerausstattung' | 'abreisetag' | 'gepackt'

export type PacklistSearchHit = {
  id: string
  was: string
  kategorie: string
  hauptkategorie: string
  /** In der aktuellen Packlisten-Ansicht sichtbar (inkl. Gepacktes-Filter) */
  visible: boolean
  hideReasons: PacklistHideReason[]
  /** Abreisedatum als YYYY-MM-DD, falls Abreise-Grund */
  abreiseDatumYmd?: string
}

export function toPacklistYYYYMMDD(d: string): string {
  if (!d) return ''
  const s = String(d).trim()
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s)
  if (iso) return iso[0]!
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s)
  if (de) return `${de[3]!}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return ''
}

export function formatPacklistDateDe(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return `${m[3]}.${m[2]}.${m[1]}`
}

export function isImmerGepacktStatus(item: Pick<PackingItem, 'status'>): boolean {
  return String(item.status || '').trim() === 'Immer gepackt'
}

export function getTodayLocalYmd(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Dauerausstattung: nur bei Ansicht „packliste“ ausblenden */
export function passesDauerausstattungFilter(
  item: Pick<PackingItem, 'status'>,
  listDisplayMode: 'alles' | 'packliste'
): boolean {
  if (listDisplayMode === 'packliste' && isImmerGepacktStatus(item)) return false
  return true
}

/**
 * Abreise-Einträge: immer kalendergesteuert – unabhängig vom Dauerausstattung-Schalter.
 */
export function passesAbreiseFilter(
  item: Pick<PackingItem, 'erst_abreisetag_gepackt'>,
  abreiseDatum?: string | null
): boolean {
  if (!item.erst_abreisetag_gepackt || !abreiseDatum) return true
  const abreiseStr = toPacklistYYYYMMDD(abreiseDatum)
  if (!abreiseStr) return true
  return getTodayLocalYmd() === abreiseStr
}

export function passesBaseVisibleFilters(
  item: Pick<PackingItem, 'status' | 'erst_abreisetag_gepackt'>,
  opts: { listDisplayMode: 'alles' | 'packliste'; abreiseDatum?: string | null }
): boolean {
  if (!passesDauerausstattungFilter(item, opts.listDisplayMode)) return false
  if (!passesAbreiseFilter(item, opts.abreiseDatum)) return false
  return true
}

export type ProfileScopeFilterOpts = {
  canEditPauschalEntries: boolean
  vacationMitreisende: Mitreisender[]
  alleScopeIds?: Set<string> | null
  pauschalGruppenFilter?: PauschalGruppenFilter
  multiGroupActive?: boolean
  ownGruppeId?: string | null
}

/** Profil-/Gruppenfilter ohne Dauerausstattung/Abreise (für Suche inkl. ausgeblendeter Einträge) */
export function passesProfileScopeFilters(
  item: PackingItem,
  selectedProfile: string | null,
  opts: ProfileScopeFilterOpts
): boolean {
  const {
    canEditPauschalEntries,
    vacationMitreisende,
    alleScopeIds,
    pauschalGruppenFilter = 'alle',
    multiGroupActive = false,
    ownGruppeId = null,
  } = opts

  const filterGruppeId = resolveActiveGruppeIdForPacking(
    selectedProfile,
    vacationMitreisende,
    ownGruppeId ?? null
  )

  if (multiGroupActive && !passesPauschalGruppenFilter(item, pauschalGruppenFilter, filterGruppeId)) {
    return false
  }

  if (!selectedProfile) {
    if (alleScopeIds === null || alleScopeIds === undefined) return true
    if (item.mitreisenden_typ === 'pauschal') return canEditPauschalEntries
    if (item.mitreisende?.length) {
      return item.mitreisende.some((m) => alleScopeIds.has(m.mitreisender_id))
    }
    if (item.mitreisenden_typ === 'alle') return alleScopeIds.size > 0
    return false
  }

  if (item.mitreisenden_typ === 'pauschal') {
    return canEditPauschalEntries
  }
  const personAssigned = item.mitreisende?.some((m) => m.mitreisender_id === selectedProfile)
  if (personAssigned) return true
  if (item.mitreisenden_typ === 'alle' && (!item.mitreisende || item.mitreisende.length === 0)) {
    if (vacationMitreisende.length === 0) return true
    return vacationMitreisende.some((m) => m.id === selectedProfile)
  }
  return false
}

export function isItemFullyPackedForProfile(
  item: PackingItem,
  selectedProfile: string | null,
  canConfirmVorgemerkt: boolean,
  ownGruppeId?: string | null,
  multiGroupActive?: boolean,
  pauschalGruppenFilter?: PauschalGruppenFilter,
  alleScopeIds?: Set<string> | null,
  allVacationGruppeIds?: string[],
  vacationMitreisende: Mitreisender[] = []
): boolean {
  if (item.mitreisenden_typ === 'pauschal') {
    const filterGruppeId = resolveActiveGruppeIdForPacking(
      selectedProfile,
      vacationMitreisende,
      ownGruppeId ?? null
    )
    const hidePacked = resolvePauschalHidePacked(item, {
      multiGroupActive: !!multiGroupActive,
      pauschalGruppenFilter: pauschalGruppenFilter ?? 'eigene',
      filterGruppeId,
      canConfirmVorgemerkt,
      finalOnly: canConfirmVorgemerkt,
      allVacationGruppeIds,
    })
    if (hidePacked !== null) return hidePacked
    if (canConfirmVorgemerkt) return item.gepackt
    return item.gepackt || !!item.gepackt_vorgemerkt
  }
  if (selectedProfile) {
    const m = item.mitreisende?.find((t) => t.mitreisender_id === selectedProfile)
    if (!m) return true
    return canConfirmVorgemerkt ? m.gepackt : m.gepackt || !!m.gepackt_vorgemerkt
  }
  if (item.mitreisende?.length) {
    const relevant = alleScopeIds
      ? item.mitreisende.filter((m) => alleScopeIds.has(m.mitreisender_id))
      : item.mitreisende
    if (relevant.length === 0) return true
    return relevant.every((m) =>
      canConfirmVorgemerkt ? m.gepackt : m.gepackt || !!m.gepackt_vorgemerkt
    )
  }
  if (item.mitreisenden_typ === 'alle') return false
  return true
}

export function matchesPacklistSearchQuery(
  item: Pick<PackingItem, 'was' | 'kategorie' | 'hauptkategorie' | 'bemerkung'>,
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return false
  const haystack = [item.was, item.kategorie, item.hauptkategorie, item.bemerkung ?? '']
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function buildPacklistSearchHits(
  items: PackingItem[],
  query: string,
  opts: {
    selectedProfile: string | null
    listDisplayMode: 'alles' | 'packliste'
    abreiseDatum?: string | null
    hidePackedItems: boolean
    canConfirmVorgemerkt: boolean
    scope: ProfileScopeFilterOpts
    allVacationGruppeIds?: string[]
  }
): PacklistSearchHit[] {
  const q = query.trim()
  if (q.length < 1) return []

  const abreiseYmd = opts.abreiseDatum ? toPacklistYYYYMMDD(opts.abreiseDatum) : ''

  return items
    .filter((item) => passesProfileScopeFilters(item, opts.selectedProfile, opts.scope))
    .filter((item) => matchesPacklistSearchQuery(item, q))
    .map((item) => {
      const hideReasons: PacklistHideReason[] = []
      if (!passesDauerausstattungFilter(item, opts.listDisplayMode)) {
        hideReasons.push('dauerausstattung')
      }
      if (!passesAbreiseFilter(item, opts.abreiseDatum)) {
        hideReasons.push('abreisetag')
      }
      const packed = isItemFullyPackedForProfile(
        item,
        opts.selectedProfile,
        opts.canConfirmVorgemerkt,
        opts.scope.ownGruppeId,
        opts.scope.multiGroupActive,
        opts.scope.pauschalGruppenFilter,
        opts.scope.alleScopeIds,
        opts.allVacationGruppeIds,
        opts.scope.vacationMitreisende
      )
      if (opts.hidePackedItems && packed && hideReasons.length === 0) {
        // Gepackt zählt nur, wenn der Eintrag sonst in der Basisansicht sichtbar wäre
        hideReasons.push('gepackt')
      }

      return {
        id: item.id,
        was: item.was,
        kategorie: item.kategorie ?? 'Allgemein',
        hauptkategorie: item.hauptkategorie ?? 'Sonstiges',
        visible: hideReasons.length === 0,
        hideReasons,
        abreiseDatumYmd: hideReasons.includes('abreisetag') && abreiseYmd ? abreiseYmd : undefined,
      }
    })
    .sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1
      return a.was.localeCompare(b.was, 'de')
    })
}
