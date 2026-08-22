'use client'

import { useEffect, useState } from 'react'
import { Link2, Info } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import type { Faelligkeit, EquipmentItem, TransportVehicle, Category, MainCategory } from '@/lib/db'
import type {
  FaelligkeitTyp,
  FaelligkeitIntervallEinheit,
  FaelligkeitIntervallRhythmus,
  FaelligkeitKategorie,
} from '@/lib/faelligkeit-status'
import {
  FAELLIGKEIT_TYP_LABELS,
  FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS,
  FAELLIGKEIT_KATEGORIE_LABELS,
  normalizeFaelligkeitTyp,
} from '@/lib/faelligkeit-status'
import type { FaelligkeitVorlage } from '@/lib/faelligkeit-vorlagen'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedFaelligkeitVorlagen } from '@/lib/offline-sync'
import { cacheFaelligkeitVorlagen } from '@/lib/offline-db'
import {
  FaelligkeitZuordnungDialog,
  formatFaelligkeitZuordnung,
} from '@/components/wartung/faelligkeit-zuordnung-dialog'

/** Gleiche Höhe wie SelectTrigger (h-9), ohne Spinner-Pfeile. */
const COMPACT_NUMBER_INPUT =
  'h-9 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]'

export interface FaelligkeitFormValues {
  name: string
  typ: FaelligkeitTyp
  equipment_id: string | null
  transport_id: string | null
  bezug_datum: string
  gueltig_bis: string
  letzte_erledigung_am: string
  intervall_einheit: FaelligkeitIntervallEinheit | ''
  intervall_wert: string
  intervall_rhythmus: FaelligkeitIntervallRhythmus
  warnung_tage_vorher: string
  sicherheitsrelevant: boolean
  quittierung_erforderlich: boolean
  notizen: string
}

const EMPTY_FORM: FaelligkeitFormValues = {
  name: '',
  typ: 'festes_datum',
  equipment_id: null,
  transport_id: null,
  bezug_datum: '',
  gueltig_bis: '',
  letzte_erledigung_am: '',
  intervall_einheit: '',
  intervall_wert: '',
  intervall_rhythmus: 'taggenau',
  warnung_tage_vorher: '30',
  sicherheitsrelevant: false,
  quittierung_erforderlich: false,
  notizen: '',
}

function itemToForm(item: Faelligkeit): FaelligkeitFormValues {
  return {
    name: item.name,
    typ: normalizeFaelligkeitTyp(item.typ),
    equipment_id: item.equipment_id,
    transport_id: item.transport_id,
    bezug_datum: item.bezug_datum?.slice(0, 10) ?? '',
    gueltig_bis: item.gueltig_bis?.slice(0, 10) ?? '',
    letzte_erledigung_am: item.letzte_erledigung_am?.slice(0, 10) ?? '',
    intervall_einheit: item.intervall_einheit ?? '',
    intervall_wert: item.intervall_wert != null ? String(item.intervall_wert) : '',
    intervall_rhythmus: item.intervall_rhythmus ?? 'taggenau',
    warnung_tage_vorher: String(item.warnung_tage_vorher),
    sicherheitsrelevant: item.sicherheitsrelevant,
    quittierung_erforderlich: item.quittierung_erforderlich,
    notizen: item.notizen ?? '',
  }
}

function vorlageToForm(v: FaelligkeitVorlage): FaelligkeitFormValues {
  return {
    ...EMPTY_FORM,
    name: v.name,
    typ: v.typ,
    intervall_einheit: v.intervall_einheit ?? '',
    intervall_wert: v.intervall_wert != null ? String(v.intervall_wert) : '',
    intervall_rhythmus: v.intervall_rhythmus ?? 'taggenau',
    warnung_tage_vorher: String(v.warnung_tage_vorher ?? 30),
    sicherheitsrelevant: v.sicherheitsrelevant ?? false,
    quittierung_erforderlich: v.quittierung_erforderlich ?? false,
    notizen: v.notizen ?? '',
  }
}

export function FaelligkeitFormDialog({
  open,
  onOpenChange,
  item,
  equipment,
  transports,
  categories,
  mainCategories,
  initialEquipmentId,
  initialEquipmentName,
  initialTransportId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Faelligkeit | null
  equipment: EquipmentItem[]
  transports: TransportVehicle[]
  categories: Category[]
  mainCategories: MainCategory[]
  initialEquipmentId?: string | null
  initialEquipmentName?: string | null
  initialTransportId?: string | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FaelligkeitFormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVorlage, setSelectedVorlage] = useState('')
  const [createKategorie, setCreateKategorie] = useState<FaelligkeitKategorie>('sonstiges')
  const [vorlagen, setVorlagen] = useState<FaelligkeitVorlage[]>([])
  const [zuordnungOpen, setZuordnungOpen] = useState(false)

  useEffect(() => {
    if (!open || item) return
    void (async () => {
      try {
        const res = await fetch('/api/faelligkeit-vorlagen')
        const raw = (await res.json()) as ApiResponse<FaelligkeitVorlage[]>
        if (raw.success && raw.data) {
          setVorlagen(raw.data)
          await cacheFaelligkeitVorlagen(raw.data)
          return
        }
      } catch {
        /* offline oder Netzwerkfehler */
      }
      const cached = await getCachedFaelligkeitVorlagen()
      if (cached.length > 0) setVorlagen(cached)
    })()
  }, [open, item])

  useEffect(() => {
    if (!open) return
    if (item) {
      setForm(itemToForm(item))
    } else {
      const base = { ...EMPTY_FORM }
      if (initialEquipmentId) {
        base.equipment_id = initialEquipmentId
        const eq = equipment.find((e) => e.id === initialEquipmentId)
        base.name = initialEquipmentName ?? eq?.was ?? ''
      } else if (initialTransportId) {
        base.transport_id = initialTransportId
        const tr = transports.find((t) => t.id === initialTransportId)
        if (tr && !base.name) base.name = tr.name
      }
      setForm(base)
    }
    setSelectedVorlage('')
    setCreateKategorie('sonstiges')
    setError(null)
    setZuordnungOpen(false)
  }, [open, item, initialEquipmentId, initialEquipmentName, initialTransportId, equipment, transports])

  const applyVorlage = (id: string) => {
    setSelectedVorlage(id)
    const v = vorlagen.find((x) => x.id === id)
    if (v) {
      const next = vorlageToForm(v)
      if (form.equipment_id) next.equipment_id = form.equipment_id
      if (form.transport_id) next.transport_id = form.transport_id
      if (form.name && initialEquipmentId) next.name = form.name
      setCreateKategorie(v.kategorie)
      setForm(next)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Name ist erforderlich')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      typ: form.typ,
      equipment_id: form.equipment_id || null,
      transport_id: form.transport_id || null,
      bezug_datum: form.bezug_datum || null,
      gueltig_bis: form.gueltig_bis || null,
      letzte_erledigung_am: form.letzte_erledigung_am || null,
      intervall_einheit: form.intervall_einheit || null,
      intervall_wert: form.intervall_wert ? Number(form.intervall_wert) : null,
      intervall_rhythmus:
        form.intervall_einheit === 'tage' || !form.intervall_einheit
          ? 'taggenau'
          : form.intervall_rhythmus,
      warnung_tage_vorher: Number(form.warnung_tage_vorher) || 30,
      sicherheitsrelevant: form.sicherheitsrelevant,
      quittierung_erforderlich: form.quittierung_erforderlich,
      notizen: form.notizen || null,
    }
    const body = item ? payload : { ...payload, kategorie: createKategorie }
    try {
      const url = item ? `/api/faelligkeiten/${item.id}` : '/api/faelligkeiten'
      const res = await fetch(url, {
        method: item ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  const showIntervall =
    form.typ === 'intervall' || (form.typ === 'alter_anzeige' && !form.gueltig_bis)

  const showIntervallRhythmus =
    showIntervall && form.intervall_einheit !== 'tage' && form.intervall_einheit !== ''

  const zuordnungLabel = formatFaelligkeitZuordnung(
    form.equipment_id,
    form.transport_id,
    equipment,
    transports
  )

  const selectedVorlageData = vorlagen.find((v) => v.id === selectedVorlage)

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={item ? 'Fälligkeit bearbeiten' : 'Fälligkeit anlegen'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {!item && (
            <div className="space-y-2">
              <Label>Aus Vorlage</Label>
              <Select value={selectedVorlage} onValueChange={applyVorlage}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional: Vorlage wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {vorlagen.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVorlageData?.hinweis && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">Rechtlicher / fachlicher Hinweis</p>
                    <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
                      {selectedVorlageData.hinweis}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <Select
              value={form.typ}
              onValueChange={(v) => setForm((f) => ({ ...f, typ: v as FaelligkeitTyp }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FAELLIGKEIT_TYP_LABELS) as FaelligkeitTyp[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {FAELLIGKEIT_TYP_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            {zuordnungLabel ? (
              <span className="min-w-0 truncate text-sm">{zuordnungLabel}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Keine Zuordnung</span>
            )}
            <Button
              type="button"
              variant={zuordnungLabel ? 'ghost' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => setZuordnungOpen(true)}
            >
              <Link2 className="mr-1.5 h-4 w-4" />
              {zuordnungLabel ? 'Ändern' : 'Zuordnen'}
            </Button>
          </div>

          {(form.typ === 'alter_anzeige' || form.typ === 'festes_datum') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {form.typ === 'alter_anzeige' && (
                <div className="space-y-2">
                  <Label>Kauf-/Herstell-Datum</Label>
                  <CalendarDatePicker
                    value={form.bezug_datum}
                    onChange={(ymd) => setForm((f) => ({ ...f, bezug_datum: ymd }))}
                    placeholder="Datum wählen"
                    dialogTitle="Kauf-/Herstell-Datum"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{form.typ === 'festes_datum' ? 'Fällig am' : 'Gültig bis'}</Label>
                <CalendarDatePicker
                  value={form.gueltig_bis}
                  onChange={(ymd) => setForm((f) => ({ ...f, gueltig_bis: ymd }))}
                  placeholder={form.typ === 'festes_datum' ? 'Fälligkeitsdatum wählen' : 'Optional'}
                  dialogTitle="Datum wählen"
                />
              </div>
            </div>
          )}

          {showIntervall ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Fälligkeitsrhythmus</p>

              <div className="space-y-2">
                <Label>Letzte Erledigung</Label>
                <CalendarDatePicker
                  value={form.letzte_erledigung_am}
                  onChange={(ymd) => setForm((f) => ({ ...f, letzte_erledigung_am: ymd }))}
                  placeholder="Datum wählen"
                  dialogTitle="Letzte Erledigung"
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Intervall</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className={`w-20 ${COMPACT_NUMBER_INPUT}`}
                      value={form.intervall_wert}
                      onChange={(e) => setForm((f) => ({ ...f, intervall_wert: e.target.value }))}
                    />
                    <Select
                      value={form.intervall_einheit || '__none__'}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          intervall_einheit:
                            v === '__none__' ? '' : (v as FaelligkeitIntervallEinheit),
                          intervall_rhythmus:
                            v === 'tage' || v === '__none__' ? 'taggenau' : f.intervall_rhythmus,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[7.5rem]">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="tage">Tage</SelectItem>
                        <SelectItem value="monate">Monate</SelectItem>
                        <SelectItem value="jahre">Jahre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showIntervallRhythmus && (
                  <div className="space-y-2">
                    <Label>Rhythmus</Label>
                    <Select
                      value={form.intervall_rhythmus}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          intervall_rhythmus: v as FaelligkeitIntervallRhythmus,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[8.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(
                            FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS
                          ) as FaelligkeitIntervallRhythmus[]
                        ).map((rhythmus) => (
                          <SelectItem key={rhythmus} value={rhythmus}>
                            {FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS[rhythmus]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Warnung</Label>
                  <div className="flex h-9 items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      className={`w-16 ${COMPACT_NUMBER_INPUT}`}
                      value={form.warnung_tage_vorher}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warnung_tage_vorher: e.target.value }))
                      }
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Tage vorher
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Warnung</Label>
              <div className="flex h-9 items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  className={`w-16 ${COMPACT_NUMBER_INPUT}`}
                  value={form.warnung_tage_vorher}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, warnung_tage_vorher: e.target.value }))
                  }
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Tage vorher</span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="faellig-sicherheitsrelevant"
                checked={form.sicherheitsrelevant}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, sicherheitsrelevant: checked === true }))
                }
              />
              <label
                htmlFor="faellig-sicherheitsrelevant"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Sicherheitsrelevant
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="faellig-quittierung"
                checked={form.quittierung_erforderlich}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, quittierung_erforderlich: checked === true }))
                }
              />
              <label
                htmlFor="faellig-quittierung"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Quittierung erforderlich
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              value={form.notizen}
              onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <FaelligkeitZuordnungDialog
        open={zuordnungOpen}
        onOpenChange={setZuordnungOpen}
        equipment={equipment}
        categories={categories}
        mainCategories={mainCategories}
        transports={transports}
        equipmentId={form.equipment_id}
        transportId={form.transport_id}
        onConfirm={(equipmentId, transportId) => {
          setForm((f) => ({
            ...f,
            equipment_id: equipmentId,
            transport_id: transportId,
          }))
        }}
      />
    </>
  )
}
