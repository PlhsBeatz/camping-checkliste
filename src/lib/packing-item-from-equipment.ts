/**
 * Packlisten-Eintrag aus Ausrüstungs-Stammdaten – gleiche Logik wie der Packlisten-Generator.
 * Unabhängig vom gerade gewählten Packprofil.
 */
import type { EquipmentItem, Mitreisender, PackingItemMitreisenderInput, Vacation } from '@/lib/db'
import { hasMultipleVacationGroups, type PauschalGruppenModus } from '@/lib/pauschal-gruppen'
import { berechneAnzahl, berechneReiseTage, istKind } from '@/lib/packing-quantity'

export type PackingAddFromEquipment = {
  anzahl: number
  transportId: string | null
  mitreisende: PackingItemMitreisenderInput[]
  pauschalGruppenModus: PauschalGruppenModus
}

export function packingAddFromEquipment(
  item: EquipmentItem,
  vacation: Vacation,
  vacationMitreisende: Mitreisender[]
): PackingAddFromEquipment {
  const vacationMitreisendeIds = vacationMitreisende.map((m) => m.id)
  const vacationMitreisendeSet = new Set(vacationMitreisendeIds)
  const vacationMitreisendeById = new Map(vacationMitreisende.map((m) => [m.id, m]))
  const reiseTage = berechneReiseTage(vacation)
  const multiGroupVacation = hasMultipleVacationGroups(vacationMitreisende)
  const typ = (item.mitreisenden_typ ?? 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte'

  let mitreisendeIds: string[] = []
  if (typ === 'alle') {
    mitreisendeIds = vacationMitreisendeIds
  } else if (typ === 'ausgewaehlte') {
    const filtered = (item.standard_mitreisende ?? []).filter((id) => vacationMitreisendeSet.has(id))
    mitreisendeIds = filtered.length > 0 ? filtered : vacationMitreisendeIds
  }

  if (item.mengenregel && typ !== 'pauschal' && mitreisendeIds.length > 0) {
    const mitreisendeMitAnzahl = mitreisendeIds.map((id) => {
      const person = vacationMitreisendeById.get(id)
      const anzahl = berechneAnzahl(item.mengenregel, reiseTage, person ? istKind(person) : false)
      return { id, anzahl }
    })
    const erwachsenenWert = berechneAnzahl(item.mengenregel, reiseTage, false)
    return {
      anzahl: Math.max(erwachsenenWert, 1),
      transportId: item.transport_id || null,
      mitreisende: mitreisendeMitAnzahl,
      pauschalGruppenModus: 'einmal',
    }
  }

  const anzahl = item.mengenregel
    ? berechneAnzahl(item.mengenregel, reiseTage, false)
    : item.standard_anzahl ?? 1

  return {
    anzahl: Math.max(anzahl, 0),
    transportId: item.transport_id || null,
    mitreisende: mitreisendeIds,
    pauschalGruppenModus: typ === 'pauschal' && multiGroupVacation ? 'offen' : 'einmal',
  }
}
