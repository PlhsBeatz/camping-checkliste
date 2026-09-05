import type { Category, EquipmentItem, MainCategory, Mitreisender, Tag, TagKategorie } from '@/lib/db'
import { todayInAppTimezone } from '@/lib/app-timezone'
import {
  shouldPrefillReplaceAcquisitionDate,
  type AgeRelevanceNeighbor,
} from '@/lib/equipment-age-relevance'
import { regelToStandardAnzahl, type MengenRegel } from '@/lib/packing-quantity'
import { parseWeightInput } from '@/lib/utils'

export interface EquipmentFormValues {
  was: string
  kategorie_id: string
  transport_id: string
  einzelgewicht: string
  standard_anzahl: string
  status: string
  details: string
  is_standard: boolean
  erst_abreisetag_gepackt: boolean
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte'
  in_pauschale_inbegriffen: boolean
  tags: string[]
  links: { url: string }[]
  standard_mitreisende: string[]
  mengenregel: MengenRegel | null
  anschaffungsdatum: string
  ausgemustert_am: string
}

export const MITREISENDEN_TYP_TRIGGER_LABELS: Record<
  EquipmentFormValues['mitreisenden_typ'],
  string
> = {
  pauschal: '📦 Pauschal',
  alle: '👥 Alle',
  ausgewaehlte: '👤 Individuell',
}

export const MITREISENDEN_TYP_OPTIONS: Array<{
  value: EquipmentFormValues['mitreisenden_typ']
  label: string
  description: string
}> = [
  { value: 'pauschal', label: '📦 Pauschal', description: 'Gemeinsam' },
  { value: 'alle', label: '👥 Alle', description: 'Für jeden einzeln' },
  { value: 'ausgewaehlte', label: '👤 Individuell', description: 'Nur für einzelne Personen' },
]

export type PacklistAssignmentState = {
  selectedPackProfile: string | null
  tempProfilModus: 'nur_person' | 'pauschal'
  tempZentralModus: 'pauschal' | 'personen'
  tempZentralPersonenIds: string[]
  vacationMitreisendeIds: string[]
}

/** Übernimmt die Packlisten-Zuordnung („Auf der Packliste“) in Gepackt für. */
export function equipmentMitreisendenFromPacklistAssignment(
  assignment: PacklistAssignmentState
): Pick<EquipmentFormValues, 'mitreisenden_typ' | 'standard_mitreisende'> {
  const {
    selectedPackProfile,
    tempProfilModus,
    tempZentralModus,
    tempZentralPersonenIds,
    vacationMitreisendeIds,
  } = assignment
  const allowed = new Set(vacationMitreisendeIds)

  if (selectedPackProfile) {
    if (tempProfilModus === 'pauschal') {
      return { mitreisenden_typ: 'pauschal', standard_mitreisende: [] }
    }
    return {
      mitreisenden_typ: 'ausgewaehlte',
      standard_mitreisende: allowed.has(selectedPackProfile) ? [selectedPackProfile] : [],
    }
  }

  if (tempZentralModus === 'pauschal') {
    return { mitreisenden_typ: 'pauschal', standard_mitreisende: [] }
  }

  const ids = tempZentralPersonenIds.filter((id) => allowed.has(id))
  return {
    mitreisenden_typ: 'ausgewaehlte',
    standard_mitreisende: ids,
  }
}

export type TagGroupForEquipment = { kat: TagKategorie; tags: Tag[] }

export type MitreisendenZeile = {
  id: string
  name: string
  urlaub_standard_mitnehmen: boolean
  user_id?: string | null
  user_role?: Mitreisender['user_role']
  personentyp?: Mitreisender['personentyp']
}

export function mitreisendenZeileAusApi(m: Mitreisender): MitreisendenZeile {
  return {
    id: m.id,
    name: m.name,
    urlaub_standard_mitnehmen: m.urlaub_standard_mitnehmen === true,
    user_id: m.user_id ?? null,
    user_role: m.user_role ?? null,
    personentyp: m.personentyp,
  }
}

export function createDefaultEquipmentFormValues(initialWas = ''): EquipmentFormValues {
  return {
    was: initialWas,
    kategorie_id: '',
    transport_id: 'none',
    einzelgewicht: '',
    standard_anzahl: '1',
    status: 'Normal',
    details: '',
    is_standard: false,
    erst_abreisetag_gepackt: false,
    mitreisenden_typ: 'alle',
    in_pauschale_inbegriffen: false,
    tags: [],
    links: [],
    standard_mitreisende: [],
    mengenregel: null,
    anschaffungsdatum: '',
    ausgemustert_am: '',
  }
}

export function equipmentFormValuesFromItem(item: EquipmentItem): EquipmentFormValues {
  return {
    was: item.was,
    kategorie_id: item.kategorie_id,
    transport_id: item.transport_id || 'none',
    einzelgewicht: item.einzelgewicht ? String(item.einzelgewicht) : '',
    standard_anzahl: String(item.standard_anzahl),
    status: item.status,
    details: item.details || '',
    is_standard: item.is_standard || false,
    erst_abreisetag_gepackt: item.erst_abreisetag_gepackt || false,
    mitreisenden_typ: item.mitreisenden_typ || 'alle',
    in_pauschale_inbegriffen: item.in_pauschale_inbegriffen || false,
    tags: item.tags?.map((t) => (typeof t === 'object' ? t.id : t)) || [],
    links: (item.links ?? []).map((l) => ({ url: l.url })),
    standard_mitreisende: item.standard_mitreisende || [],
    mengenregel: item.mengenregel ?? null,
    anschaffungsdatum: item.anschaffungsdatum?.slice(0, 10) ?? '',
    ausgemustert_am: item.ausgemustert_am?.slice(0, 10) ?? '',
  }
}

/** Vorausfüllung beim Ersetzen: Stammdaten, aber keine Exemplar-Details/Gewicht. */
export function equipmentFormValuesForReplace(
  item: EquipmentItem,
  neighbors: AgeRelevanceNeighbor[] = []
): EquipmentFormValues {
  const base = equipmentFormValuesFromItem(item)
  const prefillToday = shouldPrefillReplaceAcquisitionDate({
    name: item.was,
    categoryTitle: item.kategorie_titel,
    mainCategoryTitle: item.hauptkategorie_titel,
    neighbors,
  })
  return {
    ...base,
    details: '',
    einzelgewicht: '',
    links: [],
    status: 'Normal',
    anschaffungsdatum: prefillToday ? todayInAppTimezone() : '',
    ausgemustert_am: '',
  }
}

export function applyMengenRegelChange(
  prev: EquipmentFormValues,
  regel: MengenRegel | null
): EquipmentFormValues {
  if (!regel) return { ...prev, mengenregel: null }
  const curStd = parseInt(prev.standard_anzahl) || 1
  const derived = regelToStandardAnzahl(regel, curStd)
  return { ...prev, mengenregel: regel, standard_anzahl: String(Math.max(1, derived)) }
}

export function hasPauschaleForCategory(
  kategorieId: string,
  categories: Array<Pick<Category, 'id' | 'hauptkategorie_id' | 'pauschalgewicht'>>,
  mainCategories: Array<Pick<MainCategory, 'id' | 'pauschalgewicht'>>
): boolean {
  if (!kategorieId) return false
  const cat = categories.find((c) => c.id === kategorieId)
  if (!cat) return false
  if (cat.pauschalgewicht != null && cat.pauschalgewicht > 0) return true
  const main = mainCategories.find((m) => m.id === cat.hauptkategorie_id)
  return !!(main?.pauschalgewicht != null && main.pauschalgewicht > 0)
}

export function buildTagGroupsForEquipment(
  tagKategorien: TagKategorie[],
  tags: Tag[]
): TagGroupForEquipment[] {
  const sortedKats = [...tagKategorien].sort(
    (a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)
  )
  return sortedKats
    .map((kat) => ({
      kat,
      tags: tags
        .filter((t) => t.tag_kategorie_id === kat.id)
        .sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)),
    }))
    .filter((g) => g.tags.length > 0)
}

export function equipmentItemFromFormValues(
  form: EquipmentFormValues,
  opts: {
    id: string
    createdAt?: string
    tagCatalog?: Tag[]
    ersetztDurchId?: string | null
    kategorieTitel?: string
    hauptkategorieTitel?: string
    transportName?: string
  }
): EquipmentItem {
  const payload = buildEquipmentApiPayload(form)
  const tagById = new Map((opts.tagCatalog ?? []).map((t) => [t.id, t]))
  const now = todayInAppTimezone()
  return {
    id: opts.id,
    was: payload.was,
    kategorie_id: payload.kategorie_id,
    kategorie_titel: opts.kategorieTitel,
    hauptkategorie_titel: opts.hauptkategorieTitel,
    transport_id: payload.transport_id,
    transport_name: opts.transportName,
    einzelgewicht: payload.einzelgewicht || 0,
    standard_anzahl: payload.standard_anzahl,
    status: payload.status,
    details: payload.details || '',
    is_standard: payload.is_standard,
    erst_abreisetag_gepackt: payload.erst_abreisetag_gepackt,
    mitreisenden_typ: payload.mitreisenden_typ,
    standard_mitreisende: payload.standard_mitreisende,
    in_pauschale_inbegriffen: payload.in_pauschale_inbegriffen,
    mengenregel: payload.mengenregel,
    tags: payload.tags.map(
      (id) =>
        tagById.get(id) ?? {
          id,
          titel: id,
          tag_kategorie_id: '',
          reihenfolge: 0,
          created_at: '',
        }
    ),
    links: payload.links.map((url, i) => ({
      id: `${opts.id}-link-${i}`,
      gegenstand_id: opts.id,
      url,
      created_at: '',
    })),
    created_at: opts.createdAt ?? `${now}T00:00:00`,
    anschaffungsdatum: payload.anschaffungsdatum,
    ausgemustert_am: payload.ausgemustert_am,
    ersetzt_durch_id: opts.ersetztDurchId ?? null,
  }
}

export function buildEquipmentApiPayload(form: EquipmentFormValues) {
  return {
    was: form.was,
    kategorie_id: form.kategorie_id,
    transport_id: form.transport_id === 'none' ? null : form.transport_id || null,
    einzelgewicht: form.in_pauschale_inbegriffen ? 0 : parseWeightInput(form.einzelgewicht),
    standard_anzahl: parseInt(form.standard_anzahl) || 1,
    status: form.status,
    details: form.details || null,
    is_standard: form.is_standard,
    erst_abreisetag_gepackt: form.erst_abreisetag_gepackt,
    mitreisenden_typ: form.mitreisenden_typ,
    in_pauschale_inbegriffen: form.in_pauschale_inbegriffen,
    standard_mitreisende: form.standard_mitreisende,
    tags: form.tags,
    links: form.links.filter((link) => link.url.trim() !== '').map((link) => link.url),
    mengenregel: form.mengenregel,
    anschaffungsdatum: form.anschaffungsdatum || null,
    ausgemustert_am: form.status === 'Ausgemustert' ? form.ausgemustert_am || null : null,
  }
}

export function addEquipmentLinkField(form: EquipmentFormValues): EquipmentFormValues {
  return { ...form, links: [...form.links, { url: '' }] }
}

export function removeEquipmentLinkField(form: EquipmentFormValues, index: number): EquipmentFormValues {
  return { ...form, links: form.links.filter((_, i) => i !== index) }
}

export function updateEquipmentLinkField(
  form: EquipmentFormValues,
  index: number,
  value: string
): EquipmentFormValues {
  const newLinks = [...form.links]
  newLinks[index] = { url: value }
  return { ...form, links: newLinks }
}
