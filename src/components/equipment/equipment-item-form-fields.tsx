'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Star, X } from 'lucide-react'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import { todayInAppTimezone } from '@/lib/app-timezone'
import {
  scoreAgeRelevance,
  type AgeRelevanceNeighbor,
} from '@/lib/equipment-age-relevance'
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(45,79,30)] dark:text-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

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
  ersetztDurch?: { id: string; was: string } | null
  vorgaenger?: { id: string; was: string } | null
  onOpenRelatedItem?: (id: string) => void
  /** Nur Einträge mit gespeichertem Datum — leere Felder sind kein Signal. */
  ageNeighbors?: AgeRelevanceNeighbor[]
  /** Wechselt beim Öffnen eines anderen Dialogs, damit das Anschaffungsdatum wieder eingeklappt wird. */
  lifecycleSessionKey?: string
  /** z. B. Entweder-oder im Block Notizen */
  notesExtra?: ReactNode
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
  ersetztDurch = null,
  vorgaenger = null,
  onOpenRelatedItem,
  ageNeighbors = [],
  lifecycleSessionKey = '',
  notesExtra,
}: EquipmentItemFormFieldsProps) {
  const setField = <K extends keyof EquipmentFormValues>(key: K, fieldValue: EquipmentFormValues[K]) => {
    onChange({ ...value, [key]: fieldValue })
  }

  const showCore = variant === 'full'
  const [dateFieldRevealed, setDateFieldRevealed] = useState(false)

  useEffect(() => {
    setDateFieldRevealed(false)
  }, [lifecycleSessionKey])

  const categoryTitles = useMemo(() => {
    const cat = categories.find((c) => c.id === value.kategorie_id)
    const main =
      cat?.hauptkategorie_titel ||
      mainCategories.find((m) => m.id === cat?.hauptkategorie_id)?.titel ||
      ''
    return {
      categoryTitle: cat?.titel ?? '',
      mainCategoryTitle: main,
    }
  }, [categories, mainCategories, value.kategorie_id])

  const ageRelevance = useMemo(
    () =>
      scoreAgeRelevance({
        name: value.was,
        categoryTitle: categoryTitles.categoryTitle,
        mainCategoryTitle: categoryTitles.mainCategoryTitle,
        neighbors: ageNeighbors,
      }),
    [ageNeighbors, categoryTitles.categoryTitle, categoryTitles.mainCategoryTitle, value.was]
  )

  const showDateField =
    Boolean(value.anschaffungsdatum) || dateFieldRevealed || ageRelevance.decision === 'show'
  const canCollapseDateField =
    showDateField && !value.anschaffungsdatum && ageRelevance.decision !== 'show'
  const hasPauschale = hasPauschaleForCategory(value.kategorie_id, categories, mainCategories)
  const inPauschale = hasPauschale && value.in_pauschale_inbegriffen

  return (
    <div className="space-y-8">
      {showCore && (
        <FormSection title="Gegenstand">
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
        </FormSection>
      )}

      <FormSection title="Menge & Gewicht">
        <MengenRegelEditor
          variant="compact"
          value={value.mengenregel}
          onChange={(regel) => onChange(applyMengenRegelChange(value, regel))}
          kindOverrideDisabled={value.mitreisenden_typ === 'pauschal'}
          leading={
            <div className="min-w-0">
              <Label htmlFor={`${idPrefix}-anzahl`}>Anzahl</Label>
              <Input
                id={`${idPrefix}-anzahl`}
                type="number"
                min="1"
                value={value.standard_anzahl}
                onChange={(e) => setField('standard_anzahl', e.target.value)}
                disabled={!!value.mengenregel}
              />
            </div>
          }
          trailing={
            <div className="min-w-0 space-y-2">
              <div>
                <Label htmlFor={`${idPrefix}-gewicht`}>Gewicht</Label>
                <WeightInput
                  id={`${idPrefix}-gewicht`}
                  value={inPauschale ? '' : value.einzelgewicht}
                  onChange={(v) => setField('einzelgewicht', v)}
                  placeholder={inPauschale ? '—' : 'z.B. 0,234'}
                  disabled={inPauschale}
                />
              </div>
              {hasPauschale && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${idPrefix}-in-pauschale`}
                    checked={inPauschale}
                    onCheckedChange={(c) => {
                      if (c) {
                        onChange({ ...value, in_pauschale_inbegriffen: true, einzelgewicht: '' })
                        return
                      }
                      setField('in_pauschale_inbegriffen', false)
                    }}
                    className={EQUIPMENT_DIALOG_ROW_CHECKBOX_CLASS}
                  />
                  <Label
                    htmlFor={`${idPrefix}-in-pauschale`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    In Pauschale
                  </Label>
                </div>
              )}
            </div>
          }
        />
      </FormSection>

      <FormSection title="Mitnahme">
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
            <Select
              value={value.status}
              onValueChange={(v) => {
                if (v === 'Ausgemustert') {
                  onChange({
                    ...value,
                    status: v,
                    ausgemustert_am: value.ausgemustert_am || todayInAppTimezone(),
                  })
                  return
                }
                onChange({ ...value, status: v, ausgemustert_am: '' })
              }}
            >
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

        {showCore && (
          <div className="space-y-3">
            {showDateField ? (
              <div>
                <Label>Anschaffungsdatum</Label>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div className="min-w-[12rem] flex-1">
                    <CalendarDatePicker
                      value={value.anschaffungsdatum}
                      onChange={(ymd) => setField('anschaffungsdatum', ymd)}
                      placeholder="Optional"
                      dialogTitle="Anschaffungsdatum"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setField('anschaffungsdatum', todayInAppTimezone())}
                  >
                    Heute
                  </Button>
                  {value.anschaffungsdatum ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setField('anschaffungsdatum', '')
                        if (ageRelevance.decision !== 'show') setDateFieldRevealed(false)
                      }}
                    >
                      Entfernen
                    </Button>
                  ) : null}
                </div>
                {canCollapseDateField ? (
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setDateFieldRevealed(false)}
                  >
                    Ausblenden
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setDateFieldRevealed(true)}
              >
                Anschaffungsdatum · optional
              </button>
            )}
            {value.status === 'Ausgemustert' && (
              <div>
                <Label>Ausgemustert am</Label>
                <div className="mt-1 min-w-[12rem] max-w-sm">
                  <CalendarDatePicker
                    value={value.ausgemustert_am}
                    onChange={(ymd) => setField('ausgemustert_am', ymd)}
                    placeholder="Datum"
                    dialogTitle="Ausgemustert am"
                  />
                </div>
              </div>
            )}
            {ersetztDurch && (
              <p className="text-sm text-muted-foreground">
                Ersetzt durch{' '}
                {onOpenRelatedItem ? (
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => onOpenRelatedItem(ersetztDurch.id)}
                  >
                    {ersetztDurch.was}
                  </button>
                ) : (
                  ersetztDurch.was
                )}
              </p>
            )}
            {vorgaenger && (
              <p className="text-sm text-muted-foreground">
                Nachfolger von{' '}
                {onOpenRelatedItem ? (
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => onOpenRelatedItem(vorgaenger.id)}
                  >
                    {vorgaenger.was}
                  </button>
                ) : (
                  vorgaenger.was
                )}
              </p>
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="Packen">
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
              <span>Als Standard</span>
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
        </div>
      </FormSection>

      <FormSection title="Notizen">
        <div>
          <Label htmlFor={`${idPrefix}-details`}>Details</Label>
          <Textarea
            id={`${idPrefix}-details`}
            value={value.details}
            onChange={(e) => setField('details', e.target.value)}
            placeholder="Zusätzliche Informationen..."
            rows={2}
          />
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <Label>Links</Label>
          {value.links.map((link, idx) => (
            <div key={idx} className="flex w-full items-center gap-1.5">
              <Input
                value={link.url}
                onChange={(e) => onChange(updateEquipmentLinkField(value, idx, e.target.value))}
                placeholder="https://…"
                className="h-9"
              />
              <button
                type="button"
                aria-label="Link entfernen"
                onClick={() => onChange(removeEquipmentLinkField(value, idx))}
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange(addEquipmentLinkField(value))}
            className="inline-flex items-center gap-1 pt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Link hinzufügen
          </button>
        </div>
        {notesExtra}
      </FormSection>
    </div>
  )
}
