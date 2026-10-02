'use client'

import type { ReactNode } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import {
  EquipmentItemFormFields,
  type EquipmentFormCategory,
  type EquipmentFormTransport,
} from '@/components/equipment/equipment-item-form-fields'
import type { CategorySelectScrollTarget } from '@/components/category-select-grouped'
import type { MainCategory } from '@/lib/db'
import type { AgeRelevanceNeighbor } from '@/lib/equipment-age-relevance'
import type {
  EquipmentFormValues,
  MitreisendenZeile,
  TagGroupForEquipment,
} from '@/lib/equipment-form'
import type { TempPromotePrefillHint } from '@/lib/temp-promote-prefill'

export type EquipmentAddDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: EquipmentFormValues
  onChange: (next: EquipmentFormValues) => void
  categories: EquipmentFormCategory[]
  mainCategories: MainCategory[]
  transportVehicles: EquipmentFormTransport[]
  tagGroups: TagGroupForEquipment[]
  mitreisende: MitreisendenZeile[]
  onSave: () => void | Promise<void>
  isSaving?: boolean
  title?: string
  description?: ReactNode
  saveLabel?: string
  idPrefix?: string
  categorySelectScrollTarget?: CategorySelectScrollTarget | null
  individuelleMitreisendeExtraOpen: boolean
  onIndividuelleMitreisendeExtraOpenChange: (open: boolean) => void
  ageNeighbors?: AgeRelevanceNeighbor[]
  lifecycleSessionKey?: string
  /** Hinweise bei abweichenden Werten aus temporären Einträgen */
  prefillHints?: TempPromotePrefillHint[]
  /** z. B. Ersetzen-Checkboxen */
  footerExtra?: ReactNode
  /** z. B. Kategorie-Vorschlags-Hinweise */
  afterFields?: ReactNode
}

/**
 * Gemeinsamer Dialog/Drawer zum Anlegen (und Ersetzen) von Ausrüstung.
 * Form-State und Speichern liegen beim Aufrufer – kein doppelter Save-Code.
 */
export function EquipmentAddDialog({
  open,
  onOpenChange,
  value,
  onChange,
  categories,
  mainCategories,
  transportVehicles,
  tagGroups,
  mitreisende,
  onSave,
  isSaving = false,
  title = 'Neuen Gegenstand hinzufügen',
  description,
  saveLabel = 'Speichern',
  idPrefix = 'add-eq',
  categorySelectScrollTarget = null,
  individuelleMitreisendeExtraOpen,
  onIndividuelleMitreisendeExtraOpenChange,
  ageNeighbors,
  lifecycleSessionKey = 'create',
  prefillHints,
  footerExtra,
  afterFields,
}: EquipmentAddDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      noPadding
    >
      <div className="space-y-4 px-6 pt-4 pb-6">
        {prefillHints && prefillHints.length > 0 && (
          <div
            className="rounded-md border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <p className="font-medium mb-1">Vormerkung aus temporären Einträgen</p>
            <p className="text-muted-foreground dark:text-amber-100/80 mb-1.5">
              Es wurden zuletzt genutzte Werte eingetragen. Andere Vorkommen weichen ab:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {prefillHints.map((h) => (
                <li key={h.field}>
                  <span className="font-medium">{fieldLabel(h.field)}:</span> {h.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <EquipmentItemFormFields
          value={value}
          onChange={onChange}
          idPrefix={idPrefix}
          categories={categories}
          mainCategories={mainCategories}
          transportVehicles={transportVehicles}
          tagGroups={tagGroups}
          mitreisende={mitreisende}
          categorySelectScrollTarget={categorySelectScrollTarget}
          individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOpen}
          onIndividuelleMitreisendeExtraOpenChange={onIndividuelleMitreisendeExtraOpenChange}
          ageNeighbors={ageNeighbors}
          lifecycleSessionKey={lifecycleSessionKey}
        />

        {footerExtra}
        {afterFields}

        <div className="flex gap-2 pt-4">
          <Button onClick={() => void onSave()} disabled={isSaving} className="flex-1">
            {isSaving ? 'Speichert...' : saveLabel}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}

function fieldLabel(field: TempPromotePrefillHint['field']): string {
  switch (field) {
    case 'kategorie_id':
      return 'Kategorie'
    case 'transport_id':
      return 'Transport'
    case 'einzelgewicht':
      return 'Gewicht'
    case 'standard_anzahl':
      return 'Anzahl'
    default:
      return field
  }
}
