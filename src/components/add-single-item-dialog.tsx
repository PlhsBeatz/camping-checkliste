'use client'

import { useState, useEffect } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { WeightInput } from '@/components/ui/weight-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseWeightInput } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { EquipmentItem } from '@/lib/db'

interface CategoryWithMain {
  id: string
  titel: string
  hauptkategorie_id: string
  hauptkategorie_titel: string
  pauschalgewicht?: number | null
}

interface AddSingleItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  vacationId: string
  vacationMitreisende: Array<{ id: string; name: string }>
  selectedPackProfile: string | null
  categories: CategoryWithMain[]
  transportVehicles: Array<{ id: string; name: string }>
  tags?: Array<{ id: string; titel: string }>
  mitreisende?: Array<{ id: string; name: string }>
  onSuccess: () => void
}

const defaultForm = {
  was: '',
  anzahl: '1',
  kategorie_id: '',
  saveToEquipment: false,
  transport_id: 'none',
  einzelgewicht: '',
  standard_anzahl: '1',
  status: 'Normal',
  details: '',
  is_standard: false,
  erst_abreisetag_gepackt: false,
  mitreisenden_typ: 'alle' as 'pauschal' | 'alle' | 'ausgewaehlte',
  in_pauschale_inbegriffen: false,
  tags: [] as string[],
  links: [] as { url: string }[],
  standard_mitreisende: [] as string[],
}

export function AddSingleItemDialog({
  open,
  onOpenChange,
  initialName,
  vacationId,
  vacationMitreisende,
  selectedPackProfile,
  categories,
  transportVehicles,
  tags: tagsProp = [],
  mitreisende: mitreisendeProp = [],
  onSuccess,
}: AddSingleItemDialogProps) {
  const [form, setForm] = useState(defaultForm)
  const [isSaving, setIsSaving] = useState(false)
  const [tags, setTags] = useState<Array<{ id: string; titel: string }>>(tagsProp)
  const [mitreisende, setMitreisende] = useState<Array<{ id: string; name: string }>>(mitreisendeProp)

  useEffect(() => {
    if (open && form.saveToEquipment && tags.length === 0 && tagsProp.length === 0) {
      fetch('/api/tags')
        .then((r) => r.json() as Promise<ApiResponse<Array<{ id: string; titel: string }>>>>)
        .then((d) => {
          if (d.success && d.data) setTags(d.data)
        })
        .catch(() => {})
    }
  }, [open, form.saveToEquipment, tags.length, tagsProp.length])

  useEffect(() => {
    if (open && form.saveToEquipment && mitreisende.length === 0 && mitreisendeProp.length === 0) {
      fetch('/api/mitreisende')
        .then((r) => r.json() as Promise<ApiResponse<Array<{ id: string; name: string }>>>>)
        .then((d) => {
          if (d.success && d.data) setMitreisende(d.data)
        })
        .catch(() => {})
    }
  }, [open, form.saveToEquipment, mitreisende.length, mitreisendeProp.length])

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...defaultForm,
        was: initialName,
        anzahl: prev.anzahl,
        kategorie_id: prev.kategorie_id || '',
      }))
    }
  }, [open, initialName])

  const hasPauschaleForCategory = (kategorieId: string) => {
    const c = categories.find((x) => x.id === kategorieId)
    return !!(c && c.pauschalgewicht != null && c.pauschalgewicht > 0)
  }

  const handleSubmit = async () => {
    const was = form.was.trim()
    if (!was) {
      alert('Bitte einen Namen eingeben.')
      return
    }
    if (!form.kategorie_id) {
      alert('Bitte eine Kategorie wählen.')
      return
    }
    const anzahl = parseInt(form.anzahl, 10) || 1

    setIsSaving(true)
    try {
      if (form.saveToEquipment) {
        const payload = {
          was,
          kategorie_id: form.kategorie_id,
          transport_id: form.transport_id === 'none' ? null : form.transport_id,
          einzelgewicht: parseWeightInput(form.einzelgewicht),
          standard_anzahl: parseInt(form.standard_anzahl, 10) || 1,
          status: form.status,
          details: form.details || null,
          is_standard: form.is_standard,
          erst_abreisetag_gepackt: form.erst_abreisetag_gepackt,
          mitreisenden_typ: form.mitreisenden_typ,
          in_pauschale_inbegriffen: form.in_pauschale_inbegriffen,
          standard_mitreisende: form.standard_mitreisende,
          tags: form.tags,
          links: form.links.filter((l) => l.url.trim()).map((l) => l.url),
        }
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
        if (form.mitreisenden_typ === 'alle') {
          mitreisendeIds = vacationMitreisendeIds
        } else if (form.mitreisenden_typ === 'ausgewaehlte' && form.standard_mitreisende.length) {
          mitreisendeIds = form.standard_mitreisende.filter((id) => vacationMitreisendeIds.includes(id))
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
            transportId: form.transport_id === 'none' ? null : form.transport_id,
            mitreisende: mitreisendeIds ?? [],
          }),
        })
        const dataPack = (await resPack.json()) as ApiResponse<unknown>
        if (!dataPack.success) {
          alert('Fehler beim Hinzufügen zur Packliste: ' + (dataPack.error ?? 'Unbekannt'))
          return
        }
      } else {
        const res = await fetch('/api/packing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId,
            temporary: true,
            was,
            kategorieId: form.kategorie_id,
            anzahl,
            transportId: form.transport_id === 'none' ? null : form.transport_id,
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
            value={form.was}
            onChange={(e) => setForm((p) => ({ ...p, was: e.target.value }))}
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
              value={form.anzahl}
              onChange={(e) => setForm((p) => ({ ...p, anzahl: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="add-kategorie">Kategorie *</Label>
            <Select
              value={form.kategorie_id}
              onValueChange={(v) => setForm((p) => ({ ...p, kategorie_id: v }))}
            >
              <SelectTrigger id="add-kategorie">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.hauptkategorie_titel} – {c.titel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.saveToEquipment && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-gewicht">Gewicht</Label>
                <WeightInput
                  id="add-gewicht"
                  value={form.einzelgewicht}
                  onChange={(v) => setForm((p) => ({ ...p, einzelgewicht: v }))}
                  placeholder="z. B. 0,234"
                />
              </div>
              <div>
                <Label htmlFor="add-standard-anzahl">Standard-Anzahl</Label>
                <Input
                  id="add-standard-anzahl"
                  type="number"
                  min="1"
                  value={form.standard_anzahl}
                  onChange={(e) => setForm((p) => ({ ...p, standard_anzahl: e.target.value }))}
                />
              </div>
            </div>
            {hasPauschaleForCategory(form.kategorie_id) && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-in-pauschale"
                  checked={form.in_pauschale_inbegriffen}
                  onCheckedChange={(c) => setForm((p) => ({ ...p, in_pauschale_inbegriffen: !!c }))}
                />
                <Label htmlFor="add-in-pauschale" className="cursor-pointer text-sm">
                  In Pauschale inbegriffen
                </Label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-transport">Transport</Label>
                <Select
                  value={form.transport_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, transport_id: v }))}
                >
                  <SelectTrigger id="add-transport">
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
                <Label htmlFor="add-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger id="add-status">
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
            <div>
              <Label htmlFor="add-mitreisenden-typ">Gepackt für</Label>
              <Select
                value={form.mitreisenden_typ}
                onValueChange={(v: 'pauschal' | 'alle' | 'ausgewaehlte') =>
                  setForm((p) => ({ ...p, mitreisenden_typ: v }))
                }
              >
                <SelectTrigger id="add-mitreisenden-typ">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle</SelectItem>
                  <SelectItem value="pauschal">Pauschal</SelectItem>
                  <SelectItem value="ausgewaehlte">Individuell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.mitreisenden_typ === 'ausgewaehlte' && (
              <div>
                <Label>Mitreisende</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {mitreisende.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80"
                    >
                      <input
                        type="checkbox"
                        checked={form.standard_mitreisende.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((p) => ({
                              ...p,
                              standard_mitreisende: [...p.standard_mitreisende, m.id],
                            }))
                          } else {
                            setForm((p) => ({
                              ...p,
                              standard_mitreisende: p.standard_mitreisende.filter((id) => id !== m.id),
                            }))
                          }
                        }}
                        className="h-3 w-3"
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80"
                  >
                    <input
                      type="checkbox"
                      checked={form.tags.includes(tag.id)}
                      onChange={(e) => {
                        setForm((p) => ({
                          ...p,
                          tags: e.target.checked ? [...p.tags, tag.id] : p.tags.filter((id) => id !== tag.id),
                        }))
                      }}
                      className="h-3 w-3"
                    />
                    {tag.titel}
                  </label>
                ))}
              </div>
            </div>
            )}
            <div>
              <Label htmlFor="add-details">Details</Label>
              <Textarea
                id="add-details"
                value={form.details}
                onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                placeholder="Zusätzliche Infos..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-is-standard"
                checked={form.is_standard}
                onCheckedChange={(c) => setForm((p) => ({ ...p, is_standard: !!c }))}
              />
              <Label htmlFor="add-is-standard" className="cursor-pointer text-sm">
                Als Standard markieren
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-erst-abreisetag"
                checked={form.erst_abreisetag_gepackt}
                onCheckedChange={(c) => setForm((p) => ({ ...p, erst_abreisetag_gepackt: !!c }))}
              />
              <Label htmlFor="add-erst-abreisetag" className="cursor-pointer text-sm">
                Erst am Abreisetag packen
              </Label>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <Checkbox
            id="add-save-to-equipment"
            checked={form.saveToEquipment}
            onCheckedChange={(c) => setForm((p) => ({ ...p, saveToEquipment: !!c }))}
          />
          <Label htmlFor="add-save-to-equipment" className="cursor-pointer">
            In Ausrüstung speichern
          </Label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSubmit} disabled={isSaving} className="flex-1 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90">
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
