'use client'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ChevronLeft, ChevronRight, Plus, Menu, Star, Trash2, Upload } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { prepareCampingplatzUploadFile } from '@/lib/compress-upload-image'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import { cn } from '@/lib/utils'
import { CampingplaetzeTable } from '@/components/campingplaetze-table'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  }
}

function CampingplaetzePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  /** Google-Picker: je GOOGLE_PHOTOS_PAGE_SIZE Fotos pro Seite (Pfeile springen entsprechend) */
  const [googlePickerPageStart, setGooglePickerPageStart] = useState(0)
  const [savedFotos, setSavedFotos] = useState<CampingplatzFoto[]>([])
  const [pendingGoogle, setPendingGoogle] = useState<PlacePhotoForPicker[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fotoBusy, setFotoBusy] = useState(false)
  const adresseElementRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
    setGooglePickerPageStart(0)
  }, [placePhotos])

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

  const bearbeitenId = searchParams.get('bearbeiten')

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
    if (!showDialog || !editId) {
      if (!showDialog) setSavedFotos([])
      return
    }
    void loadFotos(editId)
  }, [showDialog, editId, loadFotos])

  const refreshCampingplatzInList = async (id: string) => {
    try {
      const r = await fetch(`/api/campingplaetze/${id}`)
      const d = (await r.json()) as ApiResponse<{ campingplatz: Campingplatz; fotos: CampingplatzFoto[] }>
      if (d.success && d.data?.campingplatz) {
        const cp = d.data.campingplatz
        setItems((prev) => {
          const o = prev.filter((c) => c.id !== id)
          return [...o, cp].sort((a, b) => a.name.localeCompare(b.name))
        })
      }
    } catch {
      /* ignore */
    }
  }

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
    setPlacePhotos([])
    setPendingGoogle([])
    setPendingFiles([])
    setSavedFotos([])
    setShowDialog(true)
  }

  useEffect(() => {
    if (!bearbeitenId || isLoading || items.length === 0 || showDialog) return
    const item = items.find((x) => x.id === bearbeitenId)
    if (item) {
      handleEdit(item)
      router.replace('/campingplaetze', { scroll: false })
    } else {
      router.replace('/campingplaetze', { scroll: false })
    }
    // handleEdit bewusst ausgelassen: einmaliges Öffnen per ?bearbeiten=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearbeitenId, isLoading, items, showDialog, router])

  const handleAdd = () => {
    setEditId(null)
    setForm(createEmptyForm())
    setPlacePhotos([])
    setPendingGoogle([])
    setPendingFiles([])
    setSavedFotos([])
    setShowDialog(true)
  }

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
      await refreshCampingplatzInList(editId)
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
      await refreshCampingplatzInList(editId)
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
      await refreshCampingplatzInList(editId)
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
      await refreshCampingplatzInList(editId)
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
        await refreshCampingplatzInList(editId)
      }

      setItems((prev) => {
        const others = prev.filter((c) => c.id !== saved.id)
        return [...others, saved].sort((a, b) => a.name.localeCompare(b.name))
      })
      setShowDialog(false)
      setEditId(null)
      setForm(createEmptyForm())
      setPlacePhotos([])
      setSavedFotos([])
      setPendingGoogle([])
      setPendingFiles([])
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
                onRowClick={(item) => router.push(`/campingplaetze/${item.id}`)}
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
            setSavedFotos([])
            setPendingGoogle([])
            setPendingFiles([])
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

export default function CampingplaetzePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Laden…
        </div>
      }
    >
      <CampingplaetzePageContent />
    </Suspense>
  )
}

