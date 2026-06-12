import type { Mitreisender } from '@/lib/db'
import type { UserRole } from '@/lib/user-roles'

/**
 * Reihenfolge: System/Admin → Kind (Personentyp) → Standard mit Konto → ohne Account
 */
export function mitreisendenAnzeigeGruppe(
  person: Partial<Pick<Mitreisender, 'user_id' | 'user_role' | 'personentyp'>> | null | undefined
): number {
  if (!person) return 4
  if (person.user_role === 'system_admin' || person.user_role === 'admin') return 0
  if (person.personentyp === 'kind') return 1
  const verknuepft = !!(person.user_id && String(person.user_id).trim())
  if (!verknuepft) return 3
  return 2
}

export function sortMitreisendeNachRolleUndName<
  T extends {
    name: string
    user_id?: string | null
    user_role?: UserRole | null
    personentyp?: Mitreisender['personentyp']
  },
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const g = mitreisendenAnzeigeGruppe(a) - mitreisendenAnzeigeGruppe(b)
    if (g !== 0) return g
    return a.name.localeCompare(b.name, 'de')
  })
}

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
