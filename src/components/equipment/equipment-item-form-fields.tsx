'use client'

import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightInput } from '@/components/ui/weight-input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CategorySelectGroupedItems,
  CategoryGroupedSelectField,
  type CategorySelectScrollTarget,
} from '@/components/category-select-grouped'
import { Checkbox } from '@/components/ui/checkbox'
import { MengenRegelEditor } from '@/components/mengen-regel-editor'
import { IndividuelleMitreisendeAuswahl } from '@/components/equipment/individuelle-mitreisende-auswahl'
import { EquipmentTagsBlock } from '@/components/equipment/equipment-tags-block'
import {
  applyMengenRegelChange,
  addEquipmentLinkField,
  removeEquipmentLinkField,
  updateEquipmentLinkField,
  hasPauschaleForCategory,
  MITREISENDEN_TYP_TRIGGER_LABELS,
  MITREISENDEN_TYP_OPTIONS,
  type EquipmentFormValues,
  type MitreisendenZeile,
  type TagGroupForEquipment,
} from '@/lib/equipment-form'
import type { Category, MainCategory } from '@/lib/db'

/** shadcn-Checkbox, dunkelgrün, Zeilen wie „Als Standard markieren“ (h-4 w-4) */
const EQUIPMENT_DIALOG_ROW_CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 border-[rgb(45,79,30)] data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:text-white data-[state=checked]:border-[rgb(45,79,30)]'

export type EquipmentFormCategory = Pick<
  Category,
  'id' | 'titel' | 'hauptkategorie_id' | 'pauschalgewicht'
> & {
  hauptkategorie_titel: string
  reihenfolge?: number
}

export type EquipmentFormTransport = { id: string; name: string }

export interface EquipmentItemFormFieldsProps {
  value: EquipmentFormValues
  onChange: (next: EquipmentFormValues) => void
  idPrefix: string
  categories: EquipmentFormCategory[]
  mainCategories: MainCategory[]
  transportVehicles: EquipmentFormTransport[]
  tagGroups: TagGroupForEquipment[]
  mitreisende: MitreisendenZeile[]
  categorySelectScrollTarget?: CategorySelectScrollTarget | null
  individuelleMitreisendeExtraOpen: boolean
  onIndividuelleMitreisendeExtraOpenChange: (open: boolean) => void
  /** 'full' = inkl. Was/Kategorie (Ausrüstung); 'details-only' = ab Gewicht (Packliste) */
  variant?: 'full' | 'details-only'
  categorySelectMode?: 'grouped' | 'plain'
}

export function EquipmentItemFormFields({
  value,
  onChange,
  idPrefix,
  categories,
  mainCategories,
  transportVehicles,
  tagGroups,
  mitreisende,
  categorySelectScrollTarget = null,
  individuelleMitreisendeExtraOpen,
  onIndividuelleMitreisendeExtraOpenChange,
  variant = 'full',
  categorySelectMode = 'grouped',
}: EquipmentItemFormFieldsProps) {
  const setField = <K extends keyof EquipmentFormValues>(key: K, fieldValue: EquipmentFormValues[K]) => {
    onChange({ ...value, [key]: fieldValue })
  }

  const showCore = variant === 'full'

  return (
    <div className="space-y-4">
      {showCore && (
        <>
          <div>
            <Label htmlFor={`${idPrefix}-was`}>Was *</Label>
            <Input
              id={`${idPrefix}-was`}
              value={value.was}
              onChange={(e) => setField('was', e.target.value)}
              placeholder="z.B. Zelt, Schlafsack..."
            />
          </div>

          <div>
            <Label htmlFor={`${idPrefix}-kategorie`}>Kategorie *</Label>
            {categorySelectMode === 'grouped' ? (
              <CategoryGroupedSelectField
                triggerId={`${idPrefix}-kategorie`}
                value={value.kategorie_id}
                onValueChange={(v) => setField('kategorie_id', v)}
                categories={categories}
                mainCategories={mainCategories}
                scrollTarget={categorySelectScrollTarget}
              />
            ) : (
              <Select
                value={value.kategorie_id}
                onValueChange={(v) => setField('kategorie_id', v)}
              >
                <SelectTrigger id={`${idPrefix}-kategorie`}>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  <CategorySelectGroupedItems categories={categories} mainCategories={mainCategories} />
                </SelectContent>
              </Select>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-gewicht`}>Gewicht</Label>
          <WeightInput
            id={`${idPrefix}-gewicht`}
            value={value.einzelgewicht}
            onChange={(v) => setField('einzelgewicht', v)}
            placeholder="z.B. 0,234"
          />
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-anzahl`}>Standard-Anzahl</Label>
          <Input
            id={`${idPrefix}-anzahl`}
            type="number"
            min="1"
            value={value.mengenregel ? '' : value.standard_anzahl}
            onChange={(e) => setField('standard_anzahl', e.target.value)}
            disabled={!!value.mengenregel}
            placeholder={value.mengenregel ? 'dynamisch' : undefined}
          />
          {value.mengenregel && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Wird dynamisch aus der Mengenregel berechnet.
            </p>
          )}
        </div>
      </div>

      <MengenRegelEditor
        value={value.mengenregel}
        onChange={(regel) => onChange(applyMengenRegelChange(value, regel))}
        kindOverrideDisabled={value.mitreisenden_typ === 'pauschal'}
      />

      {hasPauschaleForCategory(value.kategorie_id, categories, mainCategories) && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-in-pauschale`}
            checked={value.in_pauschale_inbegriffen}
            onCheckedChange={(c) => setField('in_pauschale_inbegriffen', !!c)}
          />
          <Label htmlFor={`${idPrefix}-in-pauschale`} className="cursor-pointer text-sm">
            In Pauschale inbegriffen (kein Einzelgewicht)
          </Label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-transport`}>Transport</Label>
          <Select value={value.transport_id} onValueChange={(v) => setField('transport_id', v)}>
            <SelectTrigger id={`${idPrefix}-transport`}>
              <SelectValue placeholder="Kein Transport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Transport</SelectItem>
              {transportVehicles.map((tv) => (
                <SelectItem key={tv.id} value={tv.id}>
                  {tv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select value={value.status} onValueChange={(v) => setField('status', v)}>
            <SelectTrigger id={`${idPrefix}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
              <SelectItem value="Fest Installiert">Fest Installiert</SelectItem>
              <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${idPrefix}-mitreisenden-typ`}>Gepackt für</Label>
            <Select
              value={value.mitreisenden_typ}
              onValueChange={(v: 'pauschal' | 'alle' | 'ausgewaehlte') =>
                setField('mitreisenden_typ', v)
              }
            >
              <SelectTrigger id={`${idPrefix}-mitreisenden-typ`}>
                <SelectValue>{MITREISENDEN_TYP_TRIGGER_LABELS[value.mitreisenden_typ]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MITREISENDEN_TYP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                    <div className="flex flex-col items-start gap-0.5 py-0.5">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.mitreisenden_typ === 'ausgewaehlte' && (
            <IndividuelleMitreisendeAuswahl
              mitreisende={mitreisende}
              standardMitreisendeIds={value.standard_mitreisende}
              onStandardMitreisendeChange={(next) => setField('standard_mitreisende', next)}
              extraOpen={individuelleMitreisendeExtraOpen}
              onExtraOpenChange={onIndividuelleMitreisendeExtraOpenChange}
            />
          )}
        </div>

        <div className="min-w-0">
          <EquipmentTagsBlock
            groups={tagGroups}
            selectedTagIds={value.tags}
            onToggleTag={(tagId, checked) => {
              onChange({
                ...value,
                tags: checked
                  ? [...value.tags, tagId]
                  : value.tags.filter((id) => id !== tagId),
              })
            }}
            idPrefix={idPrefix}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-details`}>Details</Label>
        <Textarea
          id={`${idPrefix}-details`}
          value={value.details}
          onChange={(e) => setField('details', e.target.value)}
          placeholder="Zusätzliche Informationen..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-is-standard`}
          checked={value.is_standard}
          onCheckedChange={(c) => setField('is_standard', !!c)}
          className={EQUIPMENT_DIALOG_ROW_CHECKBOX_CLASS}
        />
        <Label htmlFor={`${idPrefix}-is-standard`} className="cursor-pointer flex items-center gap-2">
          <Star
            className="h-4 w-4"
            style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }}
          />
          <span>Als Standard markieren</span>
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-erst-abreisetag`}
          checked={value.erst_abreisetag_gepackt}
          onCheckedChange={(c) => setField('erst_abreisetag_gepackt', !!c)}
          className={EQUIPMENT_DIALOG_ROW_CHECKBOX_CLASS}
        />
        <Label htmlFor={`${idPrefix}-erst-abreisetag`} className="cursor-pointer">
          Erst am Abreisetag packen
        </Label>
      </div>

      <div>
        <Label>Links</Label>
        {value.links.map((link, idx) => (
          <div key={idx} className="flex gap-2 mt-2">
            <Input
              value={link.url}
              onChange={(e) => onChange(updateEquipmentLinkField(value, idx, e.target.value))}
              placeholder="https://..."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(removeEquipmentLinkField(value, idx))}
            >
              Entfernen
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(addEquipmentLinkField(value))}
          className="mt-2"
        >
          Link hinzufügen
        </Button>
      </div>
    </div>
  )
}
