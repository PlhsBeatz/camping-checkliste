'use client'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Plus, Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz } from '@/lib/db'
import { cn } from '@/lib/utils'
import { CampingplaetzeTable } from '@/components/campingplaetze-table'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CampingplatzAddressAutocomplete, type PlacePhotoForPicker } from '@/components/campingplatz-address-autocomplete'
import Image from 'next/image'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CampingplatzFormState {
  id?: string
  name: string
  land: string
  bundesland: string
  ort: string
  webseite: string
  video_link: string
  platz_typ: 'Durchreise' | 'Urlaubsplatz' | 'Stellplatz'
  adresse: string
  lat: number | null
  lng: number | null
  photo_name: string | null
  pros: string[]
  cons: string[]
}

function createEmptyForm(): CampingplatzFormState {
  return {
    name: '',
    land: 'Deutschland',
    bundesland: '',
    ort: '',
    webseite: '',
    video_link: '',
    platz_typ: 'Urlaubsplatz',
    adresse: '',
    lat: null,
    lng: null,
    photo_name: null,
    pros: [''],
    cons: [''],
  }
}

export default function CampingplaetzePage() {
  const { canAccessConfig } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [items, setItems] = useState<Campingplatz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState<CampingplatzFormState>(createEmptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campingplatz | null>(null)
  const [archivePrompt, setArchivePrompt] = useState<Campingplatz | null>(null)
  const [placePhotos, setPlacePhotos] = useState<PlacePhotoForPicker[]>([])
  const adresseElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/campingplaetze')
        const data = (await res.json()) as ApiResponse<Campingplatz[]>
        if (data.success && data.data) {
          setItems(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch campingplaetze:', error)
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const handleEdit = (item: Campingplatz) => {
    setEditId(item.id)
    setForm({
      id: item.id,
      name: item.name,
      land: item.land,
      bundesland: item.bundesland ?? '',
      ort: item.ort,
      webseite: item.webseite ?? '',
      video_link: item.video_link ?? '',
      platz_typ: item.platz_typ,
      adresse: item.adresse ?? '',
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      photo_name: item.photo_name ?? null,
      pros: item.pros.length ? item.pros : [''],
      cons: item.cons.length ? item.cons : [''],
    })
    setPlacePhotos(item.photo_name ? [{ name: item.photo_name }] : [])
    setShowDialog(true)
  }

  const handleAdd = () => {
    setEditId(null)
    setForm(createEmptyForm())
    setPlacePhotos([])
    setShowDialog(true)
  }

  const handleChangeProsCons = (
    type: 'pros' | 'cons',
    index: number,
    value: string
  ) => {
    setForm((prev) => {
      const next = [...prev[type]]
      next[index] = value
      return { ...prev, [type]: next }
    })
  }

  const handleAddProsConsRow = (type: 'pros' | 'cons') => {
    setForm((prev) => ({ ...prev, [type]: [...prev[type], ''] }))
  }

  const handleRemoveProsConsRow = (type: 'pros' | 'cons', index: number) => {
    setForm((prev) => {
      const next = prev[type].filter((_, i) => i !== index)
      return { ...prev, [type]: next.length ? next : [''] }
    })
  }

  const handleSave = async () => {
    if (!form.name || !form.land || !form.ort || !form.platz_typ) {
      alert(
        'Bitte füllen Sie alle Pflichtfelder aus. Tipp: Wählen Sie die Adresse aus der Vorschlagsliste, damit Ort/Land automatisch gesetzt werden.'
      )
      return
    }
    setIsSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const payload = {
        id: editId ?? undefined,
        name: form.name.trim(),
        land: form.land.trim(),
        bundesland: form.bundesland.trim() || null,
        ort: form.ort.trim(),
        webseite: form.webseite.trim() || null,
        video_link: form.video_link.trim() || null,
        platz_typ: form.platz_typ,
        adresse: form.adresse.trim() || null,
        lat: form.lat,
        lng: form.lng,
        photo_name: form.photo_name ?? null,
        pros: form.pros.map((p) => p.trim()).filter((p) => p.length > 0),
        cons: form.cons.map((p) => p.trim()).filter((p) => p.length > 0),
      }
      const res = await fetch('/api/campingplaetze', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<Campingplatz>
      if (!data.success || !data.data) {
        alert('Fehler beim Speichern des Campingplatzes: ' + (data.error ?? 'Unbekannt'))
        return
      }
      const saved = data.data
      setItems((prev) => {
        const others = prev.filter((c) => c.id !== saved.id)
        return [...others, saved].sort((a, b) => a.name.localeCompare(b.name))
      })
      setShowDialog(false)
      setEditId(null)
      setForm(createEmptyForm())
      setPlacePhotos([])
    } catch (error) {
      console.error('Failed to save campingplatz:', error)
      alert('Fehler beim Speichern des Campingplatzes.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteOrArchive = (item: Campingplatz) => {
    setDeleteTarget(item)
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campingplaetze?id=${target.id}`, {
        method: 'DELETE',
      })
      if (res.status === 409) {
        const data = (await res.json()) as { requireArchive?: boolean; error?: string }
        if (data.requireArchive) {
          setArchivePrompt(target)
        } else {
          alert(data.error ?? 'Campingplatz kann nicht gelöscht werden.')
        }
      } else {
        const data = (await res.json()) as { success?: boolean; error?: string; archived?: boolean }
        if (!data.success) {
          alert('Fehler beim Löschen des Campingplatzes: ' + (data.error ?? 'Unbekannt'))
        } else {
          if (data.archived) {
            setItems((prev) =>
              prev.map((c) =>
                c.id === target.id ? { ...c, is_archived: true } : c
              )
            )
          } else {
            setItems((prev) => prev.filter((c) => c.id !== target.id))
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete campingplatz:', error)
      alert('Fehler beim Löschen des Campingplatzes.')
    } finally {
      setIsLoading(false)
      setDeleteTarget(null)
    }
  }

  const executeArchive = async () => {
    if (!archivePrompt) return
    const target = archivePrompt
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/campingplaetze?id=${target.id}&forceArchive=true`,
        {
          method: 'DELETE',
        }
      )
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!data.success) {
        alert('Fehler beim Archivieren des Campingplatzes: ' + (data.error ?? 'Unbekannt'))
      } else {
        setItems((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, is_archived: true } : c))
        )
      }
    } catch (error) {
      console.error('Failed to archive campingplatz:', error)
      alert('Fehler beim Archivieren des Campingplatzes.')
    } finally {
      setIsLoading(false)
      setArchivePrompt(null)
    }
  }

  return (
    <div className="min-h-screen flex">
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6">
          <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Campingplätze
                </h1>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 min-w-0 mt-4 md:mt-6 overflow-y-auto max-md:overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
                <p className="text-muted-foreground animate-pulse">
                  Campingplätze werden geladen...
                </p>
              </div>
            ) : (
              <CampingplaetzeTable
                items={items}
                onEdit={handleEdit}
                onDelete={handleDeleteOrArchive}
              />
            )}
          </div>

          {canAccessConfig && (
            <div className="fixed bottom-6 right-6 z-30">
              <Button
                size="icon"
                onClick={handleAdd}
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ResponsiveModal
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDialog(false)
            setEditId(null)
            setForm(createEmptyForm())
            setPlacePhotos([])
          } else {
            setShowDialog(true)
          }
        }}
        title={editId ? 'Campingplatz bearbeiten' : 'Neuen Campingplatz anlegen'}
        description={
          editId
            ? 'Bearbeiten Sie die Details des Campingplatzes.'
            : 'Geben Sie die Details für Ihren neuen Campingplatz ein.'
        }
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <div>
            <Label htmlFor="cp-name">Name *</Label>
            <CampingplatzAddressAutocomplete
              value={form.name}
              onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
              onResolve={(r) => {
                setForm((prev) => ({
                  ...prev,
                  name: r.placeName ?? prev.name,
                  adresse: r.address,
                  lat: r.lat,
                  lng: r.lng,
                  ort: r.ort ?? prev.ort,
                  bundesland: r.bundesland ?? prev.bundesland,
                  land: r.land ?? prev.land,
                }))
              }}
              onPlacePhotos={(photos) => setPlacePhotos(photos)}
              onElementReady={(el) => {
                adresseElementRef.current = el
              }}
              placeholder="z.B. Campingplatz am See oder Name eingeben"
            />
          </div>
          <div>
            <Label htmlFor="cp-adresse">Adresse</Label>
            <Input
              id="cp-adresse"
              value={form.adresse}
              onChange={(e) => setForm((prev) => ({ ...prev, adresse: e.target.value }))}
              placeholder="Straße, Hausnummer, PLZ, Ort (wird bei Namenssuche automatisch gefüllt)"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">
              Tipp: Im Namensfeld tippen und einen Vorschlag wählen – dann werden Adresse, Ort, Land und Koordinaten automatisch gesetzt.
            </Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-land">Land *</Label>
              <Input
                id="cp-land"
                value={form.land}
                onChange={(e) => setForm((prev) => ({ ...prev, land: e.target.value }))}
                placeholder="z.B. Deutschland"
              />
            </div>
            <div>
              <Label htmlFor="cp-bundesland">Bundesland</Label>
              <Input
                id="cp-bundesland"
                value={form.bundesland}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bundesland: e.target.value }))
                }
                placeholder="z.B. Baden-Württemberg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-webseite">Webseite</Label>
              <Input
                id="cp-webseite"
                value={form.webseite}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, webseite: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="cp-video">Video-Link</Label>
              <Input
                id="cp-video"
                value={form.video_link}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, video_link: e.target.value }))
                }
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
          <div>
            <Label htmlFor="cp-typ">Platz-Typ *</Label>
            <Select
              value={form.platz_typ}
              onValueChange={(v: 'Durchreise' | 'Urlaubsplatz' | 'Stellplatz') =>
                setForm((prev) => ({ ...prev, platz_typ: v }))
              }
            >
              <SelectTrigger id="cp-typ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Durchreise">Durchreise</SelectItem>
                <SelectItem value="Urlaubsplatz">Urlaubsplatz</SelectItem>
                <SelectItem value="Stellplatz">Stellplatz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="block mb-2">Bild aus Google Maps</Label>
            {placePhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {placePhotos.slice(0, 10).map((photo, idx) => {
                  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                  const photoUrl = apiKey && photo.name
                    ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${apiKey}`
                    : null
                  const isSelected = form.photo_name === photo.name
                  return (
                    <button
                      key={photo.name || idx}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, photo_name: photo.name }))}
                      className={cn(
                        'aspect-square rounded-lg border-2 overflow-hidden bg-muted hover:opacity-90 transition-opacity',
                        isSelected ? 'border-[rgb(45,79,30)] ring-2 ring-[rgb(45,79,30)]' : 'border-transparent'
                      )}
                    >
                      {photoUrl ? (
                        <Image src={photoUrl} alt="" width={400} height={400} unoptimized className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center justify-center h-full">Foto</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für diesen Ort sind keine Bilder von Google Maps verfügbar. Wählen Sie einen Platz aus der Namenssuche, um bis zu 10 Bilder zur Auswahl zu sehen.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Pros</Label>
              <div className="space-y-2 mt-1">
                {form.pros.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={p}
                      onChange={(e) =>
                        handleChangeProsCons('pros', idx, e.target.value)
                      }
                      placeholder="z.B. Ruhige Lage, große Stellplätze..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveProsConsRow('pros', idx)}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddProsConsRow('pros')}
                >
                  Punkt hinzufügen
                </Button>
              </div>
            </div>
            <div>
              <Label>Cons</Label>
              <div className="space-y-2 mt-1">
                {form.cons.map((c, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={c}
                      onChange={(e) =>
                        handleChangeProsCons('cons', idx, e.target.value)
                      }
                      placeholder="z.B. Laut an der Straße..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveProsConsRow('cons', idx)}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddProsConsRow('cons')}
                >
                  Punkt hinzufügen
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? 'Speichert…' : editId ? 'Campingplatz aktualisieren' : 'Campingplatz anlegen'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setShowDialog(false)
                setEditId(null)
                setForm(createEmptyForm())
                setPlacePhotos([])
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Campingplatz löschen"
        description="Möchten Sie diesen Campingplatz wirklich löschen? Falls er Urlaubsreisen zugeordnet ist, werden Sie ggf. zum Archivieren aufgefordert."
        onConfirm={executeDelete}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={!!archivePrompt}
        onOpenChange={(open) => {
          if (!open) setArchivePrompt(null)
        }}
        title="Campingplatz archivieren"
        description="Dieser Campingplatz ist bereits Urlaubsreisen zugeordnet. Statt ihn zu löschen, kann er archiviert werden und bleibt in bestehenden Urlaubsreisen sichtbar. Möchten Sie ihn archivieren?"
        onConfirm={executeArchive}
        isLoading={isLoading}
      />
    </div>
  )
}

