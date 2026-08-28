export type CategorySuggestMatch = {
  kategorie_id: string
  begruendung: string
  quelle: 'regel' | 'ki'
  duplicate: {
    id: string
    was: string
    kategorie_id: string
  } | null
}
