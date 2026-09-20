export type VerbrauchMessmodus = 'abnahme' | 'zunahme'

export interface VerbrauchMedienKatalogEintrag {
  schluessel: string
  name: string
  einheit: string
  messmodus: VerbrauchMessmodus
  label_wert_start: string
  label_wert_ende: string
  sort_order: number
  /** Optional: Dichte kg/l für Umrechnung Gewicht → Liter */
  dichte_kg_pro_l?: number | null
  /** Optional: Standard-Leergewicht des Behälters in kg */
  leergewicht_kg?: number | null
}

/** Vordefinierte Medien – erscheinen in der UI erst nach Aktivierung in verbrauch_medien. */
export const VERBRAUCH_MEDIEN_KATALOG: VerbrauchMedienKatalogEintrag[] = [
  {
    schluessel: 'gas',
    name: 'Gas',
    einheit: 'kg',
    messmodus: 'abnahme',
    label_wert_start: 'Gewicht Anfang',
    label_wert_ende: 'Gewicht Ende',
    sort_order: 10,
  },
  {
    schluessel: 'petroleum',
    name: 'Petroleum',
    einheit: 'l',
    messmodus: 'abnahme',
    label_wert_start: 'Stand Anfang',
    label_wert_ende: 'Stand Ende',
    sort_order: 20,
    dichte_kg_pro_l: 0.8,
  },
  {
    schluessel: 'wasser',
    name: 'Wasser',
    einheit: 'l',
    messmodus: 'zunahme',
    label_wert_start: 'Zählerstand Anfang',
    label_wert_ende: 'Zählerstand Ende',
    sort_order: 30,
    dichte_kg_pro_l: 1.0,
  },
  {
    schluessel: 'strom',
    name: 'Strom',
    einheit: 'kWh',
    messmodus: 'zunahme',
    label_wert_start: 'Zählerstand Anfang',
    label_wert_ende: 'Zählerstand Ende',
    sort_order: 40,
  },
  {
    schluessel: 'adblue',
    name: 'AdBlue',
    einheit: 'l',
    messmodus: 'abnahme',
    label_wert_start: 'Stand Anfang',
    label_wert_ende: 'Stand Ende',
    sort_order: 50,
    dichte_kg_pro_l: 1.09,
  },
  {
    schluessel: 'diesel',
    name: 'Diesel',
    einheit: 'l',
    messmodus: 'abnahme',
    label_wert_start: 'Stand Anfang',
    label_wert_ende: 'Stand Ende',
    sort_order: 60,
    dichte_kg_pro_l: 0.84,
  },
]

export function getKatalogEintrag(schluessel: string): VerbrauchMedienKatalogEintrag | undefined {
  return VERBRAUCH_MEDIEN_KATALOG.find((e) => e.schluessel === schluessel)
}

export function isKnownKatalogSchluessel(schluessel: string): boolean {
  return VERBRAUCH_MEDIEN_KATALOG.some((e) => e.schluessel === schluessel)
}

/** Medium unterstützt Gewicht→Liter, wenn Einheit l und Dichte gesetzt. */
export function supportsGewichtZuLiter(medium: {
  einheit: string
  dichte_kg_pro_l?: number | null
}): boolean {
  return (
    medium.einheit.trim().toLowerCase() === 'l' &&
    medium.dichte_kg_pro_l != null &&
    medium.dichte_kg_pro_l > 0
  )
}
