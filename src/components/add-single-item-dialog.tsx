'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  CategoryGroupedSelectField,
  type CategorySelectScrollTarget,
  type CategoryWithMainTitle,
} from '@/components/category-select-grouped'
import { EquipmentItemFormFields } from '@/components/equipment/equipment-item-form-fields'
import type { ApiResponse } from '@/lib/api-types'
import type { EquipmentItem, MainCategory, Mitreisender, Tag, TagKategorie } from '@/lib/db'
import { sortMitreisendeNachRolleUndName } from '@/lib/mitreisenden-sort'
import { hasMultipleVacationGroups } from '@/lib/pauschal-gruppen'
import {
  buildEquipmentApiPayload,
  buildTagGroupsForEquipment,
  createDefaultEquipmentFormValues,
  equipmentMitreisendenFromPacklistAssignment,
  mitreisendenZeileAusApi,
  type EquipmentFormValues,
  type MitreisendenZeile,
} from '@/lib/equipment-form'

interface AddSingleItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  vacationId: string
  vacationMitreisende: Mitreisender[]
  selectedPackProfile: string | null
  mainCategories: MainCategory[]
  /** Beim Aufklappen der Kategorie-Liste positionieren (Packliste: aktueller Hauptkategorie-Tab). */
  categorySelectScrollTarget?: CategorySelectScrollTarget | null
  categories: CategoryWithMainTitle[]
  transportVehicles: Array<{ id: string; name: string }>
  tags?: Array<{ id: string; titel: string }>
  mitreisende?: Mitreisender[]
  /** Admin: Eintrag zusätzlich in Ausrüstungs-Stammdaten anlegen */
  canEditEquipment?: boolean
  onSuccess: () => void
}

interface PacklistFormState {
  was: string
  anzahl: string
  kategorie_id: string
  saveToEquipment: boolean
}

const defaultPacklistForm: PacklistFormState = {
  was: '',
  anzahl: '1',
  kategorie_id: '',
  saveToEquipment: false,
}

export function AddSingleItemDialog({
  open,
  onOpenChange,
  initialName,
  vacationId,
  vacationMitreisende,
  selectedPackProfile,
  mainCategories,
  categorySelectScrollTarget = null,
  categories,
  transportVehicles,
  tags: tagsProp = [],
  mitreisende: mitreisendeProp = [],
  canEditEquipment = false,
  onSuccess,
}: AddSingleItemDialogProps) {
  const vacationMitSortiert = useMemo(
    () => sortMitreisendeNachRolleUndName(vacationMitreisende),
    [vacationMitreisende]
  )

  const [packForm, setPackForm] = useState<PacklistFormState>(defaultPacklistForm)
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormValues>(
    createDefaultEquipmentFormValues()
  )
  /** Nur ohne „In Ausrüstung speichern“, Packprofil einer Person */
  const [tempProfilModus, setTempProfilModus] = useState<'nur_person' | 'pauschal'>('nur_person')
  /** Nur ohne Ausrüstung, Packprofil Zentral / Alle */
  const [tempZentralModus, setTempZentralModus] = useState<'pauschal' | 'personen'>('pauschal')
  const [tempZentralPersonenIds, setTempZentralPersonenIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [tags, setTags] = useState<Tag[]>(tagsProp as Tag[])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])
  const [mitreisende, setMitreisende] = useState<MitreisendenZeile[]>(
    mitreisendeProp.map(mitreisendenZeileAusApi)
  )
  const [individuelleMitreisendeExtraOffen, setIndividuelleMitreisendeExtraOffen] = useState(false)

  const vacationMitreisendeIds = useMemo(
    () => vacationMitreisende.map((m) => m.id),
    [vacationMitreisende]
  )

  const applyPacklistAssignmentToEquipment = useCallback(
    (
      profilModus: 'nur_person' | 'pauschal',
      zentralModus: 'pauschal' | 'personen',
      zentralPersonenIds: string[]
    ) => {
      const { mitreisenden_typ, standard_mitreisende } = equipmentMitreisendenFromPacklistAssignment({
        selectedPackProfile,
        tempProfilModus: profilModus,
        tempZentralModus: zentralModus,
        tempZentralPersonenIds: zentralPersonenIds,
        vacationMitreisendeIds,
      })
      setEquipmentForm((prev) => ({
        ...prev,
        mitreisenden_typ,
        standard_mitreisende,
      }))
    },
    [selectedPackProfile, vacationMitreisendeIds]
  )

  const tagGroupsForEquipment = useMemo(
    () => buildTagGroupsForEquipment(tagKategorien, tags),
    [tagKategorien, tags]
  )

  const alleMitreisendeSortiert = useMemo(
    () => sortMitreisendeNachRolleUndName(mitreisende),
    [mitreisende]
  )
  const multiGroupVacation = useMemo(
    () => hasMultipleVacationGroups(vacationMitreisende),
    [vacationMitreisende]
  )
  const pauschalModusForNewItem = useMemo(() => {
    if (!multiGroupVacation) return {}
    return { pauschalGruppenModus: 'offen' as const }
  }, [multiGroupVacation])

  useEffect(() => {
    if (open && packForm.saveToEquipment && tags.length === 0 && tagsProp.length === 0) {
      fetch('/api/tags')
        .then((r) => r.json())
        .then((d: unknown) => {
          const res = d as ApiResponse<Tag[]>
          if (res.success && res.data) setTags(res.data)
        })
        .catch(() => {})
    }
  }, [open, packForm.saveToEquipment, tags.length, tagsProp.length])

  useEffect(() => {
    if (open && packForm.saveToEquipment && tagKategorien.length === 0) {
      fetch('/api/tag-kategorien')
        .then((r) => r.json())
        .then((d: unknown) => {
          const res = d as ApiResponse<TagKategorie[]>
          if (res.success && res.data) setTagKategorien(res.data)
        })
        .catch(() => {})
    }
  }, [open, packForm.saveToEquipment, tagKategorien.length])

  useEffect(() => {
    if (open && packForm.saveToEquipment && mitreisende.length === 0 && mitreisendeProp.length === 0) {
      fetch('/api/mitreisende')
        .then((r) => r.json())
        .then((d: unknown) => {
          const res = d as ApiResponse<Mitreisender[]>
          if (res.success && res.data) setMitreisende(res.data.map(mitreisendenZeileAusApi))
        })
        .catch(() => {})
    }
  }, [open, packForm.saveToEquipment, mitreisende.length, mitreisendeProp.length])

  useEffect(() => {
    if (open) {
      setPackForm((prev) => ({
        ...defaultPacklistForm,
        was: initialName,
        anzahl: prev.anzahl,
        kategorie_id: prev.kategorie_id || '',
      }))
      setEquipmentForm(createDefaultEquipmentFormValues(initialName))
      setTempProfilModus('nur_person')
      setTempZentralModus('pauschal')
      setTempZentralPersonenIds(vacationMitreisende.map((m) => m.id))
      setIndividuelleMitreisendeExtraOffen(false)
    }
  }, [open, initialName, vacationMitreisende])

  const syncPackToEquipment = (nextPack: PacklistFormState) => {
    setPackForm(nextPack)
    setEquipmentForm((prev) => ({
      ...prev,
      was: nextPack.was,
      kategorie_id: nextPack.kategorie_id,
    }))
  }

  const handleSubmit = async () => {
    const was = packForm.was.trim()
    if (!was) {
      alert('Bitte einen Namen eingeben.')
      return
    }
    if (!packForm.kategorie_id) {
      alert('Bitte eine Kategorie wählen.')
      return
    }
    const anzahl = parseInt(packForm.anzahl, 10) || 1

    const equipmentPayloadSource: EquipmentFormValues = {
      ...equipmentForm,
      was,
      kategorie_id: packForm.kategorie_id,
    }

    setIsSaving(true)
    try {
      if (packForm.saveToEquipment && canEditEquipment) {
        const payload = buildEquipmentApiPayload(equipmentPayloadSource)
        const resEq = await fetch('/api/equipment-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const dataEq = (await resEq.json()) as ApiResponse<EquipmentItem>
        if (!dataEq.success || !dataEq.data?.id) {
          alert('Fehler beim Anlegen in der Ausrüstung: ' + (dataEq.error ?? 'Unbekannt'))
          return
        }
        const gegenstandId = dataEq.data.id
        const vacationMitreisendeIds = vacationMitreisende.map((m) => m.id)
        let mitreisendeIds: string[] | undefined
        if (equipmentPayloadSource.mitreisenden_typ === 'alle') {
          mitreisendeIds = vacationMitreisendeIds
        } else if (
          equipmentPayloadSource.mitreisenden_typ === 'ausgewaehlte' &&
          equipmentPayloadSource.standard_mitreisende.length
        ) {
          mitreisendeIds = equipmentPayloadSource.standard_mitreisende.filter((id) =>
            vacationMitreisendeIds.includes(id)
          )
        }
        if (selectedPackProfile && !mitreisendeIds?.length) {
          mitreisendeIds = [selectedPackProfile]
        }
        const resPack = await fetch('/api/packing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId,
            gegenstandId,
            anzahl: dataEq.data.standard_anzahl ?? anzahl,
            transportId:
              equipmentPayloadSource.transport_id === 'none'
                ? null
                : equipmentPayloadSource.transport_id,
            mitreisende: mitreisendeIds ?? [],
            ...(equipmentPayloadSource.mitreisenden_typ === 'pauschal' ? pauschalModusForNewItem : {}),
          }),
        })
        const dataPack = (await resPack.json()) as ApiResponse<unknown>
        if (!dataPack.success) {
          alert('Fehler beim Hinzufügen zur Packliste: ' + (dataPack.error ?? 'Unbekannt'))
          return
        }
      } else {
        let mitreisendeForTemp: string[] | undefined
        if (selectedPackProfile) {
          mitreisendeForTemp = tempProfilModus === 'nur_person' ? [selectedPackProfile] : undefined
        } else if (tempZentralModus === 'pauschal') {
          mitreisendeForTemp = undefined
        } else {
          const allowed = new Set(vacationMitreisende.map((m) => m.id))
          const ids = tempZentralPersonenIds.filter((id) => allowed.has(id))
          if (ids.length === 0) {
            alert('Bitte mindestens eine Person auswählen.')
            setIsSaving(false)
            return
          }
          mitreisendeForTemp = ids
        }
        const res = await fetch('/api/packing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId,
            temporary: true,
            was,
            kategorieId: packForm.kategorie_id,
            anzahl,
            transportId: equipmentForm.transport_id === 'none' ? null : equipmentForm.transport_id,
            mitreisende: mitreisendeForTemp,
            ...(!mitreisendeForTemp?.length && multiGroupVacation ? pauschalModusForNewItem : {}),
          }),
        })
        const data = (await res.json()) as ApiResponse<unknown>
        if (!data.success) {
          alert('Fehler beim Hinzufügen: ' + (data.error ?? 'Unbekannt'))
          return
        }
      }
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      alert('Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Gegenstand hinzufügen"
      description="Neuen Eintrag anlegen und zur Packliste hinzufügen"
      contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      noPadding
    >
      <div className="space-y-4 px-6 pt-4 pb-6">
        <div>
          <Label htmlFor="add-was">Bezeichnung *</Label>
          <Input
            id="add-was"
            value={packForm.was}
            onChange={(e) => syncPackToEquipment({ ...packForm, was: e.target.value })}
            placeholder="z. B. Hummus, Brot..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="add-anzahl">Menge</Label>
            <Input
              id="add-anzahl"
              type="number"
              min="1"
              value={packForm.anzahl}
              onChange={(e) => setPackForm((p) => ({ ...p, anzahl: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="add-kategorie">Kategorie *</Label>
            <CategoryGroupedSelectField
              triggerId="add-kategorie"
              value={packForm.kategorie_id}
              onValueChange={(v) => syncPackToEquipment({ ...packForm, kategorie_id: v })}
              categories={categories}
              mainCategories={mainCategories}
              scrollTarget={categorySelectScrollTarget}
            />
          </div>
        </div>

        {!packForm.saveToEquipment && (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">Auf der Packliste</p>
          {selectedPackProfile ? (
            <RadioGroup
              value={tempProfilModus}
              onValueChange={(v) => {
                const modus = v as 'nur_person' | 'pauschal'
                setTempProfilModus(modus)
                if (packForm.saveToEquipment) {
                  applyPacklistAssignmentToEquipment(modus, tempZentralModus, tempZentralPersonenIds)
                }
              }}
              className="gap-3"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="nur_person" id="tmp-nur-person" className="mt-0.5" />
                <Label htmlFor="tmp-nur-person" className="cursor-pointer font-normal leading-snug">
                  Nur für{' '}
                  {vacationMitSortiert.find((m) => m.id === selectedPackProfile)?.name ??
                    'dieses Packprofil'}
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="pauschal" id="tmp-profil-pauschal" className="mt-0.5" />
                <Label htmlFor="tmp-profil-pauschal" className="cursor-pointer font-normal leading-snug">
                  Pauschal
                </Label>
              </div>
            </RadioGroup>
          ) : (
            <>
              <RadioGroup
                value={tempZentralModus}
                onValueChange={(v) => {
                  const modus = v as 'pauschal' | 'personen'
                  setTempZentralModus(modus)
                  if (packForm.saveToEquipment) {
                    applyPacklistAssignmentToEquipment(tempProfilModus, modus, tempZentralPersonenIds)
                  }
                }}
                className="gap-3"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="pauschal" id="tmp-zentral-pauschal" className="mt-0.5" />
                  <Label htmlFor="tmp-zentral-pauschal" className="cursor-pointer font-normal leading-snug">
                    Pauschal
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="personen" id="tmp-zentral-personen" className="mt-0.5" />
                  <Label htmlFor="tmp-zentral-personen" className="cursor-pointer font-normal leading-snug">
                    Für folgende Personen
                  </Label>
                </div>
              </RadioGroup>
              {tempZentralModus === 'personen' && (
                <div className="space-y-2 pl-1">
                  {vacationMitSortiert.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Personen für diesen Urlaub hinterlegt.</p>
                  ) : (
                    vacationMitSortiert.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={tempZentralPersonenIds.includes(m.id)}
                          onCheckedChange={(c) => {
                            const nextIds =
                              c === true
                                ? [...new Set([...tempZentralPersonenIds, m.id])]
                                : tempZentralPersonenIds.filter((id) => id !== m.id)
                            setTempZentralPersonenIds(nextIds)
                            if (packForm.saveToEquipment) {
                              applyPacklistAssignmentToEquipment(
                                tempProfilModus,
                                tempZentralModus,
                                nextIds
                              )
                            }
                          }}
                        />
                        <span>{m.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
        )}

        {canEditEquipment && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="add-save-to-equipment"
              checked={packForm.saveToEquipment}
              onCheckedChange={(c) => {
                const saveToEquipment = !!c
                setPackForm((p) => ({ ...p, saveToEquipment }))
                if (saveToEquipment) {
                  setEquipmentForm((prev) => ({
                    ...prev,
                    was: packForm.was,
                    kategorie_id: packForm.kategorie_id,
                  }))
                  applyPacklistAssignmentToEquipment(
                    tempProfilModus,
                    tempZentralModus,
                    tempZentralPersonenIds
                  )
                }
              }}
            />
            <Label htmlFor="add-save-to-equipment" className="cursor-pointer">
              In Ausrüstung speichern
            </Label>
          </div>
        )}

        {packForm.saveToEquipment && (
          <EquipmentItemFormFields
            value={equipmentForm}
            onChange={setEquipmentForm}
            idPrefix="pack-eq"
            categories={categories}
            mainCategories={mainCategories}
            transportVehicles={transportVehicles}
            tagGroups={tagGroupsForEquipment}
            mitreisende={alleMitreisendeSortiert}
            categorySelectScrollTarget={categorySelectScrollTarget}
            individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOffen}
            onIndividuelleMitreisendeExtraOpenChange={setIndividuelleMitreisendeExtraOffen}
            variant="details-only"
          />
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
          >
            {isSaving ? 'Speichert...' : 'Speichern'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
