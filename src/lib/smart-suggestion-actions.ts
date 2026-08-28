import type { D1Database } from '@cloudflare/workers-types'
import {
  addPackingItem,
  getEquipmentItem,
  getMitreisendeForVacation,
  getPacklisteId,
  getVacation,
  updateCampingplatz,
} from '@/lib/db'
import { packingAddFromEquipment } from '@/lib/packing-item-from-equipment'
import { createAlternativeGroup } from '@/lib/packing-alternatives'
import { isRejectedPlatzplanUrl } from '@/lib/platzplan-url'
import {
  setSmartSuggestionStatus,
  type SmartSuggestion,
} from '@/lib/smart-suggestions'

export async function applySmartSuggestionAccept(
  db: D1Database,
  suggestion: SmartSuggestion,
  opts?: { url?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (suggestion.kind === 'packing_add' || suggestion.kind === 'packing_copack') {
    const vacationId = String(suggestion.payload.vacation_id ?? suggestion.kontext_id ?? '')
    const gegenstandId = String(suggestion.payload.gegenstand_id ?? '')
    if (!vacationId || !gegenstandId) {
      return { ok: false, error: 'Urlaub oder Gegenstand fehlt' }
    }
    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) return { ok: false, error: 'Packliste nicht gefunden' }

    const existing = await db
      .prepare(
        'SELECT id FROM packlisten_eintraege WHERE packliste_id = ? AND gegenstand_id = ? LIMIT 1'
      )
      .bind(packlisteId, gegenstandId)
      .first<{ id: string }>()
    if (existing) {
      await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
      return { ok: true }
    }

    const item = await getEquipmentItem(db, gegenstandId)
    if (!item) return { ok: false, error: 'Gegenstand nicht in der Ausrüstung gefunden' }
    const vacation = await getVacation(db, vacationId)
    if (!vacation) return { ok: false, error: 'Urlaub nicht gefunden' }
    const people = await getMitreisendeForVacation(db, vacationId)
    const spec = packingAddFromEquipment(item, vacation, people)
    const added = await addPackingItem(
      db,
      packlisteId,
      gegenstandId,
      spec.anzahl,
      null,
      spec.transportId,
      spec.mitreisende,
      spec.pauschalGruppenModus
    )
    if (!added) return { ok: false, error: 'Gegenstand konnte nicht auf die Packliste' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  if (suggestion.kind === 'xor_candidate') {
    const rawOptions = suggestion.payload.options
    let optionIds: string[][] = []
    if (Array.isArray(rawOptions)) {
      optionIds = rawOptions
        .map((o) => {
          if (!o || typeof o !== 'object') return []
          const rec = o as { gegenstand_ids?: unknown; ids?: unknown }
          const ids = rec.gegenstand_ids ?? rec.ids
          return Array.isArray(ids) ? ids.map(String).filter(Boolean) : []
        })
        .filter((ids) => ids.length > 0)
    }
    if (optionIds.length < 2) {
      const ids = suggestion.payload.gegenstand_ids
      const idList = Array.isArray(ids) ? ids.map(String) : []
      optionIds = idList.map((id) => [id])
    }
    const names = suggestion.payload.names
    const nameList = Array.isArray(names) ? names.map(String) : []
    const titel =
      nameList.length >= 2 ? `${nameList[0]} oder ${nameList[1]}` : suggestion.titel
    const group = await createAlternativeGroup(db, optionIds, titel)
    if (!group) return { ok: false, error: 'Gruppe konnte nicht angelegt werden' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  if (suggestion.kind === 'place_gap') {
    await setSmartSuggestionStatus(db, suggestion.id, 'dismissed')
    return { ok: true }
  }

  if (suggestion.kind === 'platzplan') {
    const cpId = String(suggestion.payload.campingplatz_id ?? suggestion.kontext_id ?? '')
    const chosen = String(opts?.url ?? suggestion.payload.url ?? '').trim()
    if (!cpId || !chosen) return { ok: false, error: 'Platzplan-URL fehlt' }
    if (!/^https?:\/\//i.test(chosen)) {
      return { ok: false, error: 'Ungültige Platzplan-URL' }
    }
    if (isRejectedPlatzplanUrl(chosen)) {
      return { ok: false, error: 'XML- und Sitemap-URLs sind kein Platzplan.' }
    }
    const updated = await updateCampingplatz(db, cpId, { platzplan_url: chosen })
    if (!updated) return { ok: false, error: 'Campingplatz konnte nicht aktualisiert werden' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
  return { ok: true }
}
