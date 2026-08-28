import type { D1Database } from '@cloudflare/workers-types'
import { addPackingItem, getPacklisteId, updateCampingplatz } from '@/lib/db'
import { createAlternativeGroup } from '@/lib/packing-alternatives'
import {
  setSmartSuggestionStatus,
  type SmartSuggestion,
} from '@/lib/smart-suggestions'

export async function applySmartSuggestionAccept(
  db: D1Database,
  suggestion: SmartSuggestion
): Promise<{ ok: boolean; error?: string }> {
  if (suggestion.kind === 'packing_add' || suggestion.kind === 'packing_copack') {
    const vacationId = String(suggestion.payload.vacation_id ?? suggestion.kontext_id ?? '')
    const gegenstandId = String(suggestion.payload.gegenstand_id ?? '')
    if (!vacationId || !gegenstandId) {
      return { ok: false, error: 'Urlaub oder Gegenstand fehlt' }
    }
    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) return { ok: false, error: 'Packliste nicht gefunden' }
    const added = await addPackingItem(db, packlisteId, gegenstandId, 1)
    if (!added) return { ok: false, error: 'Gegenstand ist vermutlich schon auf der Packliste' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  if (suggestion.kind === 'xor_candidate') {
    const ids = suggestion.payload.gegenstand_ids
    const names = suggestion.payload.names
    const idList = Array.isArray(ids) ? ids.map(String) : []
    const nameList = Array.isArray(names) ? names.map(String) : []
    const titel =
      nameList.length >= 2 ? `${nameList[0]} oder ${nameList[1]}` : suggestion.titel
    const group = await createAlternativeGroup(db, idList, titel)
    if (!group) return { ok: false, error: 'Gruppe konnte nicht angelegt werden' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  if (suggestion.kind === 'platzplan') {
    const cpId = String(suggestion.payload.campingplatz_id ?? suggestion.kontext_id ?? '')
    const url = String(suggestion.payload.url ?? '')
    if (!cpId || !url) return { ok: false, error: 'Platzplan-URL fehlt' }
    const updated = await updateCampingplatz(db, cpId, { platzplan_url: url })
    if (!updated) return { ok: false, error: 'Campingplatz konnte nicht aktualisiert werden' }
    await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
    return { ok: true }
  }

  await setSmartSuggestionStatus(db, suggestion.id, 'accepted')
  return { ok: true }
}
