import type { Faelligkeit, FaelligkeitHistorieInitial } from '@/lib/db'

export function getInitialHistorieDatum(initial: FaelligkeitHistorieInitial): string | null {
  return initial.bezug_datum ?? initial.initial_erledigung_am ?? null
}

export function faelligkeitToHistorieInitial(f: Faelligkeit): FaelligkeitHistorieInitial {
  return {
    angelegt_am: f.created_at.slice(0, 10),
    typ: f.typ,
    bezug_datum: f.bezug_datum?.slice(0, 10) ?? null,
    gueltig_bis: f.gueltig_bis?.slice(0, 10) ?? null,
    initial_erledigung_am: f.initial_erledigung_am?.slice(0, 10) ?? null,
    naechste_faelligkeit: f.naechste_faelligkeit?.slice(0, 10) ?? null,
    intervall_einheit: f.intervall_einheit,
    intervall_wert: f.intervall_wert,
    notizen: f.notizen,
  }
}

export function isHistorieViewPayload(
  data: unknown
): data is { initial: FaelligkeitHistorieInitial; entries: unknown[] } {
  return (
    typeof data === 'object' &&
    data != null &&
    'initial' in data &&
    'entries' in data &&
    Array.isArray((data as { entries: unknown[] }).entries)
  )
}
