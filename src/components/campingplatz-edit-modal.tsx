'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Star, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { prepareCampingplatzUploadFile } from '@/lib/compress-upload-image'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CampingplatzAddressAutocomplete, type PlacePhotoForPicker } from '@/components/campingplatz-address-autocomplete'
import Image from 'next/image'
import { placesPhotoProxyUrl } from '@/lib/places-photo'
import { campingplatzFotoImageSrc } from '@/lib/campingplatz-photo-url'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

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
  aufwunschliste: boolean
  top_favorit: boolean
}

/** UI: Fotos pro Rasterseite (Google liefert max. 10 pro Place-Details-Antwort, ohne Pagination). */
const GOOGLE_PHOTOS_PAGE_SIZE = 10

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
    aufwunschliste: true,
    top_favorit: false,
  }
}

export interface CampingplatzEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = neuen Campingplatz anlegen */
  initialCampingplatz: Campingplatz | null
  onSaved: (saved: Campingplatz) => void
  /** Nach Foto-Aktionen: z. B. Listenzeile oder Detailansicht aktualisieren */
  onRefreshCampingplatz?: (id: string) => Promise<void>
}

export function CampingplatzEditModal({
  open,
  onOpenChange,
  initialCampingplatz,
  onSaved,
  onRefreshCampingplatz,
}: CampingplatzEditModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<CampingplatzFormState>(createEmptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [placePhotos, setPlacePhotos] = useState<PlacePhotoForPicker[]>([])
  /** Google-Picker: je GOOGLE_PHOTOS_PAGE_SIZE Fotos pro Seite (Pfeile springen entsprechend) */
  const [googlePickerPageStart, setGooglePickerPageStart] = useState(0)
  const [savedFotos, setSavedFotos] = useState<CampingplatzFoto[]>([])
  const [pendingGoogle, setPendingGoogle] = useState<PlacePhotoForPicker[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fotoBusy, setFotoBusy] = useState(false)
  const adresseElementRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setGooglePickerPageStart(0)
  }, [placePhotos])

  const initialKey = initialCampingplatz?.id ?? 'new'

  useEffect(() => {
    if (!open) return
    if (initialCampingplatz) {
      setEditId(initialCampingplatz.id)
      setForm({
        id: initialCampingplatz.id,
        name: initialCampingplatz.name,
        land: initialCampingplatz.land,
        bundesland: initialCampingplatz.bundesland ?? '',
        ort: initialCampingplatz.ort,
        webseite: initialCampingplatz.webseite ?? '',
        video_link: initialCampingplatz.video_link ?? '',
        platz_typ: initialCampingplatz.platz_typ,
        adresse: initialCampingplatz.adresse ?? '',
        lat: initialCampingplatz.lat ?? null,
        lng: initialCampingplatz.lng ?? null,
        photo_name: initialCampingplatz.photo_name ?? null,
        pros: initialCampingplatz.pros.length ? initialCampingplatz.pros : [''],
        cons: initialCampingplatz.cons.length ? initialCampingplatz.cons : [''],
        aufwunschliste:
          (initialCampingplatz as { aufwunschliste?: boolean }).aufwunschliste !== false,
        top_favorit: !!(initialCampingplatz as { top_favorit?: boolean }).top_favorit,
      })
    } else {
      setEditId(null)
      setForm(createEmptyForm())
    }
    setPlacePhotos([])
    setPendingGoogle([])
    setPendingFiles([])
    setSavedFotos([])
    // Nur bei Öffnen bzw. Wechsel des Datensatzes neu befüllen (nicht bei jedem Parent-Re-Render).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCampingplatz nur über initialKey
  }, [open, initialKey])

  const loadFotos = useCallback(async (campingplatzId: string) => {
    try {
      const res = await fetch(`/api/campingplaetze/${campingplatzId}/fotos`)
      const data = (await res.json()) as ApiResponse<CampingplatzFoto[]>
      if (data.success && data.data) setSavedFotos(data.data)
      else setSavedFotos([])
    } catch {
      setSavedFotos([])
    }
  }, [])

  useEffect(() => {
    if (!open || !editId) {
      if (!open) setSavedFotos([])
      return
    }
    void loadFotos(editId)
  }, [open, editId, loadFotos])

  const refreshCampingplatzRemote = async (id: string) => {
    await onRefreshCampingplatz?.(id)
  }

  const closeAndReset = useCallback(() => {
    setEditId(null)
    setForm(createEmptyForm())
    setPlacePhotos([])
    setSavedFotos([])
    setPendingGoogle([])
    setPendingFiles([])
    onOpenChange(false)
  }, [onOpenChange])

  const googlePickerAlreadyAdded = (name: string) =>
    savedFotos.some((f) => f.google_photo_name === name) ||
    pendingGoogle.some((p) => p.name === name)

  const addGoogleFromPicker = async (photo: PlacePhotoForPicker) => {
    if (!photo.name) return
    if (googlePickerAlreadyAdded(photo.name)) return
    if (!editId) {
      setPendingGoogle((prev) => [...prev, photo])
      return
    }
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze/${editId}/fotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_photo_name: photo.name,
          google_attributions: photo.authorAttributions,
          importToR2: true,
          setAsCover: savedFotos.length === 0,
        }),
      })
      const data = (await res.json()) as ApiResponse<CampingplatzFoto>
      if (!data.success) {
        alert(data.error ?? 'Foto konnte nicht hinzugefügt werden')
        return
      }
      await loadFotos(editId)
      await refreshCampingplatzRemote(editId)
    } finally {
      setFotoBusy(false)
    }
  }

  const removePendingGoogle = (name: string) => {
    setPendingGoogle((prev) => prev.filter((p) => p.name !== name))
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const setCoverFoto = async (fotoId: string) => {
    if (!editId) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze/${editId}/fotos/${fotoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setCover: true }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!data.success) {
        alert(data.error ?? 'Standardbild konnte nicht gesetzt werden')
        return
      }
      await loadFotos(editId)
      await refreshCampingplatzRemote(editId)
    } finally {
      setFotoBusy(false)
    }
  }

  const deleteSavedFoto = async (fotoId: string) => {
    if (!editId) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze/${editId}/fotos/${fotoId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!data.success) {
        alert(data.error ?? 'Foto konnte nicht gelöscht werden')
        return
      }
      await loadFotos(editId)
      await refreshCampingplatzRemote(editId)
    } finally {
      setFotoBusy(false)
    }
  }

  const onPickUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    const raw: File[] = []
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)
      if (f) raw.push(f)
    }
    void (async () => {
      const next = await Promise.all(raw.map((f) => prepareCampingplatzUploadFile(f)))
      if (!editId) {
        setPendingFiles((prev) => [...prev, ...next])
      } else {
        void uploadFilesForEdit(next)
      }
    })()
    e.target.value = ''
  }

  const uploadFilesForEdit = async (files: File[]) => {
    if (!editId) return
    setFotoBusy(true)
    try {
      let first = savedFotos.length === 0
      for (const file of files) {
        const prepared = await prepareCampingplatzUploadFile(file)
        const fd = new FormData()
        fd.append('file', prepared)
        fd.append('setAsCover', first ? 'true' : 'false')
        first = false
        const res = await fetch(`/api/campingplaetze/${editId}/fotos`, {
          method: 'POST',
          body: fd,
        })
        const data = (await res.json()) as ApiResponse<CampingplatzFoto>
        if (!data.success) {
          alert(data.error ?? 'Upload fehlgeschlagen')
          break
        }
      }
      await loadFotos(editId)
      await refreshCampingplatzRemote(editId)
    } finally {
      setFotoBusy(false)
    }
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
      const coverGoogle = savedFotos.find((f) => f.is_cover)?.google_photo_name ?? null
      const payload: {
        id?: string
        name: string
        land: string
        bundesland: string | null
        ort: string
        webseite: string | null
        video_link: string | null
        platz_typ: 'Durchreise' | 'Urlaubsplatz' | 'Stellplatz'
        adresse: string | null
        lat: number | null
        lng: number | null
        photo_name?: string | null
        pros: string[]
        cons: string[]
        aufwunschliste: boolean
        top_favorit: boolean
      } = {
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
        pros: form.pros.map((p) => p.trim()).filter((p) => p.length > 0),
        cons: form.cons.map((p) => p.trim()).filter((p) => p.length > 0),
        aufwunschliste: form.aufwunschliste,
        top_favorit: form.top_favorit,
      }
      if (editId) {
        if (savedFotos.length > 0) payload.photo_name = coverGoogle
      } else {
        payload.photo_name = null
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
      let saved = data.data
      const newId = saved.id

      if (!editId && (pendingGoogle.length > 0 || pendingFiles.length > 0)) {
        let isFirst = true
        for (const p of pendingGoogle) {
          if (!p.name) continue
          const fr = await fetch(`/api/campingplaetze/${newId}/fotos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              google_photo_name: p.name,
              google_attributions: p.authorAttributions,
              importToR2: true,
              setAsCover: isFirst,
            }),
          })
          const fd = (await fr.json()) as ApiResponse<CampingplatzFoto>
          if (!fd.success) {
            alert(fd.error ?? 'Google-Foto konnte nicht gespeichert werden')
            break
          }
          isFirst = false
        }
        for (const file of pendingFiles) {
          const prepared = await prepareCampingplatzUploadFile(file)
          const formData = new FormData()
          formData.append('file', prepared)
          formData.append('setAsCover', isFirst ? 'true' : 'false')
          isFirst = false
          const fr = await fetch(`/api/campingplaetze/${newId}/fotos`, {
            method: 'POST',
            body: formData,
          })
          const fd = (await fr.json()) as ApiResponse<CampingplatzFoto>
          if (!fd.success) {
            alert(fd.error ?? 'Upload fehlgeschlagen')
            break
          }
        }
        const fotosRes = await fetch(`/api/campingplaetze/${newId}/fotos`)
        const fotosJson = (await fotosRes.json()) as ApiResponse<CampingplatzFoto[]>
        const syncName =
          fotosJson.success && fotosJson.data
            ? fotosJson.data.find((f) => f.is_cover)?.google_photo_name ?? null
            : null
        await fetch('/api/campingplaetze', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newId, photo_name: syncName }),
        }).catch(() => undefined)
        const detail = await fetch(`/api/campingplaetze/${newId}`)
        const dj = (await detail.json()) as ApiResponse<{
          campingplatz: Campingplatz
          fotos: CampingplatzFoto[]
        }>
        if (dj.success && dj.data?.campingplatz) saved = dj.data.campingplatz
      } else if (editId) {
        await refreshCampingplatzRemote(editId)
      }

      onSaved(saved)
      closeAndReset()
    } catch (error) {
      console.error('Failed to save campingplatz:', error)
      alert('Fehler beim Speichern des Campingplatzes.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next) closeAndReset()
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
                  webseite: r.website ?? prev.webseite,
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

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="cp-wunsch"
                checked={form.aufwunschliste}
                onCheckedChange={(c) =>
                  setForm((prev) => ({ ...prev, aufwunschliste: c === true }))
                }
              />
              <div className="space-y-0.5">
                <Label htmlFor="cp-wunsch" className="cursor-pointer font-medium">
                  Auf Wunschliste
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ausgeschlossene Plätze bleiben aktiv (z. B. für die Historie), erscheinen aber nicht
                  mehr als geplantes Wunschziel.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="cp-top"
                checked={form.top_favorit}
                onCheckedChange={(c) =>
                  setForm((prev) => ({ ...prev, top_favorit: c === true }))
                }
              />
              <div className="space-y-0.5">
                <Label htmlFor="cp-top" className="cursor-pointer font-medium inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  Top-Favorit
                </Label>
                <p className="text-xs text-muted-foreground">
                  Besonders empfehlenswerte Plätze – in der Liste hervorgehoben.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="block mb-2">Gespeicherte Fotos</Label>
              {editId && savedFotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {savedFotos.map((f) => (
                    <div
                      key={f.id}
                      className="relative aspect-square rounded-lg border overflow-hidden bg-muted group"
                    >
                      <Image
                        src={campingplatzFotoImageSrc(f.id, 400)}
                        alt=""
                        width={400}
                        height={400}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 bg-black/50 justify-center">
                        <Button
                          type="button"
                          size="icon"
                          variant={f.is_cover ? 'default' : 'secondary'}
                          className="h-8 w-8"
                          disabled={fotoBusy || f.is_cover}
                          title="Als Standard für die Liste"
                          onClick={() => void setCoverFoto(f.id)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          disabled={fotoBusy}
                          title="Foto löschen"
                          onClick={() => void deleteSavedFoto(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {f.is_cover && (
                        <span
                          className="pointer-events-none absolute top-1 left-1 inline-flex h-5 w-5 items-center justify-center rounded bg-[rgb(45,79,30)] text-white shadow-sm"
                          aria-label="Standardbild für die Liste"
                          title="Standardbild für die Liste"
                        >
                          <Star className="h-3.5 w-3.5 shrink-0 fill-white stroke-white" strokeWidth={1.25} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : !editId && (pendingGoogle.length > 0 || pendingFiles.length > 0) ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Nach dem Speichern des Campingplatzes werden {pendingGoogle.length} Google-Foto(s){' '}
                    und {pendingFiles.length} Upload(s) übernommen.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingGoogle.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center gap-1 rounded border px-2 py-1 bg-muted text-xs"
                      >
                        <span className="truncate max-w-[140px]">Google</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-1" onClick={() => removePendingGoogle(p.name!)}>
                          ×
                        </Button>
                      </div>
                    ))}
                    {pendingFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-1 rounded border px-2 py-1 bg-muted text-xs"
                      >
                        <span className="truncate max-w-[140px]">{file.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-1" onClick={() => removePendingFile(i)}>
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : editId ? (
                <p className="text-sm text-muted-foreground">Noch keine Fotos gespeichert.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Speichern Sie zuerst den Campingplatz oder fügen Sie unten Google-Fotos / Uploads zur Warteliste hinzu.
                </p>
              )}
            </div>

            <div>
              <Label className="block mb-2">Eigenes Foto hochladen</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={onPickUploadFiles}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fotoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Datei wählen…
              </Button>
            </div>

            <div>
              <Label className="block mb-2">Aus Google Maps hinzufügen</Label>
              {placePhotos.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={googlePickerPageStart <= 0}
                      aria-label="Vorherige Google-Fotos"
                      onClick={() =>
                        setGooglePickerPageStart((s) => Math.max(0, s - GOOGLE_PHOTOS_PAGE_SIZE))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="min-w-0 flex-1 text-center text-xs text-muted-foreground">
                      {googlePickerPageStart + 1}–
                      {Math.min(googlePickerPageStart + GOOGLE_PHOTOS_PAGE_SIZE, placePhotos.length)} von{' '}
                      {placePhotos.length}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={googlePickerPageStart + GOOGLE_PHOTOS_PAGE_SIZE >= placePhotos.length}
                      aria-label="Nächste Google-Fotos"
                      onClick={() =>
                        setGooglePickerPageStart((s) => s + GOOGLE_PHOTOS_PAGE_SIZE)
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {placePhotos
                      .slice(googlePickerPageStart, googlePickerPageStart + GOOGLE_PHOTOS_PAGE_SIZE)
                      .map((photo, idx) => {
                        const photoUrl = photo.name ? placesPhotoProxyUrl(photo.name, 400) : null
                        const added = photo.name ? googlePickerAlreadyAdded(photo.name) : true
                        return (
                          <div
                            key={photo.name || `${googlePickerPageStart}-${idx}`}
                            className="flex min-w-0 flex-col gap-1"
                          >
                            <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                              {photoUrl ? (
                                <Image
                                  src={photoUrl}
                                  alt=""
                                  width={400}
                                  height={400}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                                  Foto
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={added ? 'secondary' : 'default'}
                              disabled={fotoBusy || added || !photo.name}
                              className="h-7 w-full px-1 text-[10px] leading-tight sm:h-8 sm:text-xs"
                              onClick={() => void addGoogleFromPicker(photo)}
                            >
                              {added ? 'Bereits hinzugefügt' : 'Hinzufügen'}
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Wählen Sie einen Platz aus der Namenssuche oder per Google-Maps-Link – dann können Sie alle von
                  Google gelieferten Bilder durchblättern und übernehmen.
                </p>
              )}
            </div>

            {savedFotos.some((f) => f.google_attributions_json) && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {savedFotos
                  .flatMap((f) => {
                    try {
                      return f.google_attributions_json
                        ? (JSON.parse(f.google_attributions_json) as string[])
                        : []
                    } catch {
                      return []
                    }
                  })
                  .filter(Boolean)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(' · ')}
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
              onClick={() => closeAndReset()}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  )
}

