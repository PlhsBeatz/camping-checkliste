'use client'

import { EquipmentAddDialog } from '@/components/equipment/equipment-add-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { TempPromoteEquipmentDialogState } from '@/hooks/use-temp-promote-equipment'

/** Identischer Drawer/Dialog wie auf der Vorschläge-Seite – nur Darstellung, State im Hook. */
export function TempPromoteEquipmentDialog({ state }: { state: TempPromoteEquipmentDialogState }) {
  const {
    open,
    onOpenChange,
    suggestion,
    form,
    setForm,
    hints,
    categories,
    mainCategories,
    transportVehicles,
    tagGroups,
    mitreisende,
    individuelleMitreisendeExtraOpen,
    setIndividuelleMitreisendeExtraOpen,
    categorySelectScrollTarget,
    replaceTempInFuturePacklists,
    setReplaceTempInFuturePacklists,
    categorySuggestion,
    categoryLoading,
    isSaving,
    onSave,
  } = state

  return (
    <EquipmentAddDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neuen Gegenstand hinzufügen"
      description={
        suggestion
          ? `Aus temporären Packlisteneinträgen „${String(suggestion.payload.was ?? '')}“.`
          : undefined
      }
      value={form}
      onChange={setForm}
      categories={categories}
      mainCategories={mainCategories}
      transportVehicles={transportVehicles}
      tagGroups={tagGroups}
      mitreisende={mitreisende}
      individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOpen}
      onIndividuelleMitreisendeExtraOpenChange={setIndividuelleMitreisendeExtraOpen}
      categorySelectScrollTarget={categorySelectScrollTarget}
      lifecycleSessionKey={suggestion ? `temp-promote:${suggestion.id}` : 'temp-promote'}
      prefillHints={hints}
      onSave={onSave}
      isSaving={isSaving}
      footerExtra={
        <div className="flex items-start gap-2 rounded-md border px-3 py-2">
          <Checkbox
            id="replace-temp-in-future-packlists"
            checked={replaceTempInFuturePacklists}
            onCheckedChange={(c) => setReplaceTempInFuturePacklists(!!c)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="replace-temp-in-future-packlists"
              className="cursor-pointer text-sm font-normal"
            >
              Auf zukünftigen Packlisten den temporären Eintrag durch die Ausrüstung ersetzen
            </Label>
            <p className="text-xs text-muted-foreground">
              Nur Urlaube, die noch nicht begonnen haben. Vergangene Packlisten bleiben unverändert.
            </p>
          </div>
        </div>
      }
      afterFields={
        <>
          {categoryLoading && (
            <p className="text-xs text-muted-foreground">Kategorie wird vorgeschlagen…</p>
          )}
          {categorySuggestion?.duplicate && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Ähnlich zu vorhandener Ausrüstung „{categorySuggestion.duplicate.was}“.
            </p>
          )}
          {categorySuggestion && !categorySuggestion.duplicate && !form.kategorie_id && (
            <p className="text-xs text-muted-foreground">{categorySuggestion.begruendung}</p>
          )}
        </>
      }
    />
  )
}
