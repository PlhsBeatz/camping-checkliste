import type { Mitreisender } from '@/lib/db'

/**
 * Reihenfolge für Mitreisenden-Anzeigen: Admin (Eltern) → Kind → weitere mit Konto (z. B. Gast) → ohne Account.
 * Bei fehlenden Stammdaten (undefined) wird wie „ohne Kontext“ am Ende gruppiert.
 */
export function mitreisendenAnzeigeGruppe(
  person: Partial<Pick<Mitreisender, 'user_id' | 'user_role'>> | null | undefined
): number {
  if (!person) return 4
  if (person.user_role === 'admin') return 0
  if (person.user_role === 'kind') return 1
  const verknuepft = !!(person.user_id && String(person.user_id).trim())
  if (!verknuepft) return 3
  return 2
}

/** Volle Stammdaten: nach Rolle, dann Name */
export function sortMitreisendeNachRolleUndName<
  T extends { name: string; user_id?: string | null; user_role?: Mitreisender['user_role'] | null },
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const g = mitreisendenAnzeigeGruppe(a) - mitreisendenAnzeigeGruppe(b)
    if (g !== 0) return g
    return a.name.localeCompare(b.name, 'de')
  })
}

/**
 * Nur `id` + `name` (z. B. Dialoge aus Packliste); Rolle wird über `stammdaten` je `id` aufgelöst.
 */
export function sortMitreisendenZeilenNachStammdaten<T extends { id: string; name: string }>(
  zeilen: readonly T[],
  stammdaten: readonly Mitreisender[]
): T[] {
  const byId = new Map(stammdaten.map((m) => [m.id, m]))
  return [...zeilen].sort((a, b) => {
    const g = mitreisendenAnzeigeGruppe(byId.get(a.id)) - mitreisendenAnzeigeGruppe(byId.get(b.id))
    if (g !== 0) return g
    return a.name.localeCompare(b.name, 'de')
  })
}
