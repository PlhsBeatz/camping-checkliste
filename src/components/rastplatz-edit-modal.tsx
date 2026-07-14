'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink, MapPin, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import type { Rastplatz, RastplatzBewertung, RastplatzKategorie } from '@/lib/db'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RastplatzAddressAutocomplete } from '@/components/rastplatz-address-autocomplete'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RASTPLATZ_MERKMALE } from '@/lib/rastplatz-merkmale'
import { inferRastplatzKategorieFromGoogleTypes } from '@/lib/rastplatz-place-types'
import { cn } from '@/lib/utils'
import { openRastplatzInAdac, openRastplatzInGoogleMaps } from '@/lib/maps-export'

const KATEGORIEN: { value: RastplatzKategorie; label: string }[] = [
  { value: 'rastplatz', label: 'Rastplatz' },
  { value: 'tankstelle', label: 'Tankstelle' },
  { value: 'parkplatz', label: 'Parkplatz' },
  { value: 'autohof', label: 'Autohof' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

interface RastplatzFormState {
  id?: string
  name: string
  bewertung: RastplatzBewertung
  kategorie: RastplatzKategorie
  merkmale: string[]
  bemerkungen: string
  adresse: string
  ort: string
  land: string
  bundesland: string
  lat: number | null
  lng: number | null
  google_place_id: string | null
}

function createEmptyForm(): RastplatzFormState {
  return {
    name: '',
    bewertung: 'empfehlung',
    kategorie: 'rastplatz',
    merkmale: [],
    bemerkungen: '',
    adresse: '',
    ort: '',
    land: 'Deutschland',
    bundesland: '',
    lat: null,
    lng: null,
    google_place_id: null,
  }
}

export interface RastplatzEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialRastplatz: Rastplatz | null
  onSaved: (saved: Rastplatz) => void
  /** Vorausgefüllte Daten (z. B. aus Nearby-Suche) */
  prefilled?: Partial<RastplatzFormState> | null
}

export function RastplatzEditModal({
  open,
  onOpenChange,
  initialRastplatz,
  onSaved,
  prefilled,
}: RastplatzEditModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<RastplatzFormState>(createEmptyForm)

  const initialKey = initialRastplatz?.id ?? prefilled?.name ?? 'new'

  useEffect(() => {
    if (!open) return
    if (initialRastplatz) {
      setForm({
        id: initialRastplatz.id,
        name: initialRastplatz.name,
        bewertung: initialRastplatz.bewertung,
        kategorie: initialRastplatz.kategorie,
        merkmale: [...initialRastplatz.merkmale],
        bemerkungen: initialRastplatz.bemerkungen ?? '',
        adresse: initialRastplatz.adresse ?? '',
        ort: initialRastplatz.ort ?? '',
        land: initialRastplatz.land ?? 'Deutschland',
        bundesland: initialRastplatz.bundesland ?? '',
        lat: initialRastplatz.lat,
        lng: initialRastplatz.lng,
        google_place_id: initialRastplatz.google_place_id,
      })
    } else if (prefilled) {
      setForm({ ...createEmptyForm(), ...prefilled })
    } else {
      setForm(createEmptyForm())
    }
  }, [open, initialKey, initialRastplatz, prefilled])

  const toggleMerkmal = (id: string) => {
    setForm((f) => ({
      ...f,
      merkmale: f.merkmale.includes(id)
        ? f.merkmale.filter((m) => m !== id)
        : [...f.merkmale, id],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || form.lat == null || form.lng == null) {
      alert('Name und Koordinaten sind erforderlich.')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        bewertung: form.bewertung,
        kategorie: form.kategorie,
        merkmale: form.merkmale,
        bemerkungen: form.bemerkungen.trim() || null,
        adresse: form.adresse.trim() || null,
        ort: form.ort.trim() || null,
        land: form.land.trim() || null,
        bundesland: form.bundesland.trim() || null,
        lat: form.lat,
        lng: form.lng,
        google_place_id: form.google_place_id,
      }
      const isEdit = !!form.id
      const res = await fetch('/api/rastplaetze', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: form.id, ...payload } : payload),
      })
      const data = (await res.json()) as ApiResponse<Rastplatz>
      if (!data.success || !data.data) {
        alert(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      onSaved(data.data)
      onOpenChange(false)
    } catch (e) {
      alert('Speichern fehlgeschlagen: ' + String(e))
    } finally {
      setIsSaving(false)
    }
  }

  const mapsPreview =
    form.lat != null && form.lng != null
      ? ({ lat: form.lat, lng: form.lng, name: form.name } as Rastplatz)
      : null

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={form.id ? 'Rastplatz bearbeiten' : 'Rastplatz anlegen'}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={form.bewertung === 'empfehlung' ? 'default' : 'outline'}
            className={cn(
              'flex-1',
              form.bewertung === 'empfehlung' && 'bg-green-700 hover:bg-green-800'
            )}
            onClick={() => setForm((f) => ({ ...f, bewertung: 'empfehlung' }))}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Empfehlung
          </Button>
          <Button
            type="button"
            variant={form.bewertung === 'no_go' ? 'default' : 'outline'}
            className={cn(
              'flex-1',
              form.bewertung === 'no_go' && 'bg-red-700 hover:bg-red-800'
            )}
            onClick={() => setForm((f) => ({ ...f, bewertung: 'no_go' }))}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            No-Go
          </Button>
        </div>

        <div>
          <Label>Adresse / Ort suchen</Label>
          <RastplatzAddressAutocomplete
            value={form.adresse || form.name}
            onChange={(v) => setForm((f) => ({ ...f, adresse: v }))}
            onResolve={(r) =>
              setForm((f) => ({
                ...f,
                name: r.placeName ?? r.address ?? f.name,
                adresse: r.address,
                ort: r.ort ?? f.ort,
                land: r.land ?? f.land,
                bundesland: r.bundesland ?? f.bundesland,
                lat: r.lat,
                lng: r.lng,
                google_place_id: r.googlePlaceId ?? f.google_place_id,
                kategorie:
                  r.googleTypes?.length || r.primaryType
                    ? inferRastplatzKategorieFromGoogleTypes(r.googleTypes, r.primaryType)
                    : f.kategorie,
              }))
            }
          />
        </div>

        <div>
          <Label htmlFor="rp-name">Name</Label>
          <Input
            id="rp-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <Label>Kategorie</Label>
          <Select
            value={form.kategorie}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, kategorie: v as RastplatzKategorie }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KATEGORIEN.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Merkmale</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {RASTPLATZ_MERKMALE.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMerkmal(m.id)}
                className={cn(
                  'px-2 py-1 rounded-full text-xs border transition-colors',
                  form.merkmale.includes(m.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:bg-accent'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="rp-bemerkungen">Bemerkungen</Label>
          <Textarea
            id="rp-bemerkungen"
            value={form.bemerkungen}
            onChange={(e) => setForm((f) => ({ ...f, bemerkungen: e.target.value }))}
            rows={3}
          />
        </div>

        {mapsPreview && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openRastplatzInGoogleMaps(mapsPreview)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Google Maps
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openRastplatzInAdac(mapsPreview)}
            >
              <MapPin className="h-4 w-4 mr-1" />
              ADAC
            </Button>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
