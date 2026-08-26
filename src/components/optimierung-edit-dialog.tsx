'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { Optimierung, OptimierungFoto, Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { prepareCampingplatzUploadFile } from '@/lib/compress-upload-image'
import { computeFaelligAm, describeFaelligkeit } from '@/lib/optimierung-faelligkeit'
import { useToast } from '@/hooks/use-toast'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { isOffline, showQueuedToast } from '@/lib/offline-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PhotoLightbox } from '@/components/photo-lightbox'
import {
  emptyOptimierungForm,
  FAELLIGKEIT_OPTIONS,
  formFromOptimierung,
  isWorkflowStatus,
  PRIO_OPTIONS,
  SegmentedButtons,
  showsFaelligkeitFields,
  STATUS_LABEL,
  STATUS_WORKFLOW_OPTIONS,
  type OptimierungEditForm,
  optimierungFotoSrc,
} from '@/components/optimierung-shared'

export function OptimierungEditDialog({
  open,
  onOpenChange,
  isCreate,
  item,
  vacations,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isCreate: boolean
  item: Optimierung | null
  vacations: Vacation[]
  onSaved: (opts?: { createdId?: string }) => Promise<void> | void
  onDeleted?: (id: string) => Promise<void> | void
}) {
  const { toast } = useToast()
  const { mutate } = useOptimisticMutation()

  const [form, setForm] = useState<OptimierungEditForm>(emptyOptimierungForm)
  const [saving, setSaving] = useState(false)
  const [editFotos, setEditFotos] = useState<OptimierungFoto[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fotoBusy, setFotoBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const pendingPreviewUrls = useMemo(
    () => pendingFiles.map((file) => URL.createObjectURL(file)),
    [pendingFiles]
  )
  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrls) URL.revokeObjectURL(url)
    }
  }, [pendingPreviewUrls])

  const loadFotos = useCallback(async (optimierungId: string) => {
    try {
      const res = await fetch(`/api/optimierungen/${optimierungId}/fotos`)
      const json = (await res.json()) as ApiResponse<OptimierungFoto[]>
      if (json.success && json.data) setEditFotos(json.data)
      else setEditFotos([])
    } catch {
      setEditFotos([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (isCreate || !item) {
      setForm(emptyOptimierungForm())
      setEditFotos([])
      setPendingFiles([])
      return
    }
    setForm(formFromOptimierung(item))
    setPendingFiles([])
    void loadFotos(item.id)
  }, [open, isCreate, item, loadFotos])

  const close = () => {
    onOpenChange(false)
    setEditFotos([])
    setPendingFiles([])
    setLightboxId(null)
  }

  const uploadPendingFiles = async (optimierungId: string, files: File[]) => {
    for (const file of files) {
      const compressed = await prepareCampingplatzUploadFile(file)
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/optimierungen/${optimierungId}/fotos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Foto-Upload fehlgeschlagen')
      }
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!isCreate && !item) return
    const titel = form.titel.trim()
    if (!titel) {
      toast({ title: 'Titel erforderlich', variant: 'destructive' })
      return
    }

    const links = form.links.map((u) => u.trim()).filter(Boolean)
    const showFaelligkeit = showsFaelligkeitFields(form.status)
    const faelligkeit_modus = showFaelligkeit ? form.faelligkeit_modus || null : null
    const payload = {
      titel,
      notiz: form.notiz.trim() || null,
      status: form.status,
      prioritaet: form.prioritaet,
      faelligkeit_modus,
      links,
    }

    setSaving(true)
    try {
      let newId: string | null = null
      let queued = false
      if (isCreate) {
        const clientId = crypto.randomUUID()
        const result = await mutate({
          table: 'optimierungen',
          action: 'post',
          key: clientId,
          payload: { ...payload, id: clientId },
        })
        if (!result.ok && !result.queued) {
          toast({
            title: 'Anlegen fehlgeschlagen',
            description: result.error || 'Unbekannter Fehler',
            variant: 'destructive',
          })
          return
        }
        queued = result.queued
        newId = clientId
      } else {
        const id = item!.id
        const result = await mutate({
          table: 'optimierungen',
          action: 'put',
          key: id,
          payload,
        })
        if (!result.ok && !result.queued) {
          toast({
            title: 'Speichern fehlgeschlagen',
            description: result.error || 'Unbekannter Fehler',
            variant: 'destructive',
          })
          return
        }
        queued = result.queued
        newId = id
      }

      if (pendingFiles.length > 0 && newId) {
        if (isOffline() || queued) {
          toast({
            title: queued ? 'Offline gespeichert' : 'Eintrag gespeichert',
            description: 'Fotos können erst online hochgeladen werden.',
          })
          close()
          await onSaved(isCreate ? { createdId: newId } : undefined)
          return
        }
        try {
          await uploadPendingFiles(newId, pendingFiles)
        } catch (e) {
          console.error(e)
          toast({
            title: 'Eintrag gespeichert, Foto-Upload fehlgeschlagen',
            description: e instanceof Error ? e.message : 'Unbekannter Fehler',
            variant: 'destructive',
          })
          close()
          await onSaved(isCreate ? { createdId: newId } : undefined)
          return
        }
      }

      close()
      if (!queued) {
        await onSaved(isCreate ? { createdId: newId ?? undefined } : undefined)
        toast({ title: isCreate ? 'Optimierung angelegt' : 'Gespeichert' })
      } else {
        await onSaved(isCreate ? { createdId: newId ?? undefined } : undefined)
        showQueuedToast({
          description: isCreate
            ? 'Die Optimierung wird synchronisiert, sobald Sie online sind.'
            : undefined,
        })
      }
    } catch (e) {
      console.error(e)
      toast({
        title: isCreate ? 'Anlegen fehlgeschlagen' : 'Speichern fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    setDeleting(true)
    try {
      const result = await mutate({
        table: 'optimierungen',
        action: 'delete',
        key: item.id,
      })
      if (!result.ok && !result.queued) {
        toast({
          title: 'Löschen fehlgeschlagen',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setDeleteOpen(false)
      close()
      await onDeleted?.(item.id)
      if (result.queued) showQueuedToast({ description: 'Löschen wird bei Verbindung synchronisiert.' })
      else toast({ title: 'Gelöscht' })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Löschen fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDiscard = async () => {
    if (!item) return
    setDiscarding(true)
    try {
      const result = await mutate({
        table: 'optimierungen',
        action: 'put',
        key: item.id,
        payload: { status: 'verworfen' },
      })
      if (!result.ok && !result.queued) {
        toast({
          title: 'Verwerfen fehlgeschlagen',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setDiscardOpen(false)
      close()
      await onSaved()
      if (result.queued) showQueuedToast()
      else toast({ title: 'Als verworfen markiert' })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Verwerfen fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setDiscarding(false)
    }
  }

  const onPickFiles = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'gallery' | 'camera'
  ) => {
    const raw = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (raw.length === 0) return

    setFotoBusy(true)
    try {
      const compressed = await Promise.all(raw.map((f) => prepareCampingplatzUploadFile(f)))
      if (isCreate || !item) {
        setPendingFiles((prev) => [...prev, ...compressed])
        return
      }
      await uploadPendingFiles(item.id, compressed)
      await loadFotos(item.id)
      await onSaved()
      toast({
        title: compressed.length === 1 ? 'Foto hinzugefügt' : `${compressed.length} Fotos hinzugefügt`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Foto-Upload fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setFotoBusy(false)
      void mode
    }
  }

  const deleteFoto = async (fotoId: string) => {
    if (!item) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/optimierungen/${item.id}/fotos/${fotoId}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !json.success) {
        toast({
          title: 'Foto konnte nicht gelöscht werden',
          description: json.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setEditFotos((prev) => prev.filter((f) => f.id !== fotoId))
      await onSaved()
    } catch (e) {
      console.error(e)
      toast({
        title: 'Foto konnte nicht gelöscht werden',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setFotoBusy(false)
    }
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
          else onOpenChange(true)
        }}
        title={isCreate ? 'Neue Optimierung' : 'Optimierung bearbeiten'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="opt-titel">Titel</Label>
            <Input
              id="opt-titel"
              className="mt-1"
              value={form.titel}
              onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
              autoFocus={isCreate}
            />
          </div>
          <div>
            <Label htmlFor="opt-notiz">Notiz</Label>
            <Textarea
              id="opt-notiz"
              className="mt-1 min-h-[80px]"
              value={form.notiz}
              onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Status</Label>
            {!isCreate && !isWorkflowStatus(form.status) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aktuell: {STATUS_LABEL[form.status]}. Zum Wiederöffnen einen Status wählen.
              </p>
            ) : null}
            <SegmentedButtons
              ariaLabel="Status"
              value={isWorkflowStatus(form.status) ? form.status : ''}
              options={STATUS_WORKFLOW_OPTIONS}
              onChange={(v) => {
                setForm((f) => ({
                  ...f,
                  status: v,
                  ...(v === 'idee' ? { faelligkeit_modus: '' } : {}),
                }))
              }}
            />
          </div>
          <div>
            <Label>Priorität</Label>
            <SegmentedButtons
              ariaLabel="Priorität"
              value={form.prioritaet}
              options={PRIO_OPTIONS}
              onChange={(v) => setForm((f) => ({ ...f, prioritaet: v }))}
            />
          </div>

          {showsFaelligkeitFields(form.status) ? (
            <div>
              <Label>Fälligkeit</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FAELLIGKEIT_OPTIONS.map((opt) => {
                  const selected = form.faelligkeit_modus === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          faelligkeit_modus: selected ? '' : opt.value,
                        }))
                      }
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        selected
                          ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white'
                          : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {form.faelligkeit_modus ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {(() => {
                    const modus = form.faelligkeit_modus
                    const bezugYmd =
                      modus === 'saisonstart'
                        ? !isCreate &&
                          item?.faelligkeit_modus === 'saisonstart' &&
                          item.faelligkeit_bezug_am &&
                          form.faelligkeit_modus === item.faelligkeit_modus
                          ? item.faelligkeit_bezug_am
                          : undefined
                        : undefined
                    const faelligAm = computeFaelligAm(modus, vacations, {
                      bezugYmd,
                    })
                    return describeFaelligkeit(modus, faelligAm, vacations)
                  })()}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Optional — für spätere Erinnerungen ein Chip wählen.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="mb-0">Anhänge & Links</Label>
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e, 'gallery')}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPickFiles(e, 'camera')}
            />

            <div className="grid grid-cols-3 gap-2">
              {editFotos.map((f) => (
                <div
                  key={f.id}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => setLightboxId(f.id)}
                    aria-label="Foto groß anzeigen"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optimierungFotoSrc(f.id)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    disabled={fotoBusy || isCreate}
                    onClick={() => void deleteFoto(f.id)}
                    aria-label="Foto löschen"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white shadow-sm disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingPreviewUrls[i]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label="Ausstehendes Foto entfernen"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={fotoBusy || saving}
                    aria-label="Foto hinzufügen"
                    className={cn(
                      'aspect-square rounded-lg border border-dashed border-input',
                      'bg-muted/30 text-muted-foreground',
                      'flex flex-col items-center justify-center gap-1 px-2',
                      'hover:bg-muted/50 hover:text-foreground transition-colors',
                      'disabled:opacity-50 disabled:pointer-events-none'
                    )}
                  >
                    <Plus className="h-6 w-6" strokeWidth={2} />
                    <span className="text-[10px] font-medium leading-tight text-center">
                      Foto hinzufügen
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    disabled={fotoBusy || saving}
                    onSelect={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Foto aufnehmen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={fotoBusy || saving}
                    onSelect={() => galleryInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Aus Galerie wählen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isCreate ? (
              <p className="text-xs text-muted-foreground">
                Fotos werden nach dem Anlegen hochgeladen.
              </p>
            ) : null}

            <div className="space-y-1.5 pt-1">
              {form.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={link}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.links]
                        next[idx] = e.target.value
                        return { ...f, links: next }
                      })
                    }
                    placeholder="https://…"
                    className="h-9"
                  />
                  <button
                    type="button"
                    aria-label="Link entfernen"
                    onClick={() =>
                      setForm((f) => {
                        const next = f.links.filter((_, i) => i !== idx)
                        return { ...f, links: next.length > 0 ? next : [''] }
                      })
                    }
                    className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, links: [...f.links, ''] }))}
                className="inline-flex items-center gap-1 pt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Link hinzufügen
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {!isCreate && item ? (
              <>
                {item.status !== 'verworfen' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setDiscardOpen(true)}
                    disabled={saving || discarding}
                  >
                    Verwerfen
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setDeleteOpen(true)}
                  disabled={saving}
                  aria-label="Löschen"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            <div className="ml-auto flex min-w-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={saving}>
                Abbrechen
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || fotoBusy}
              >
                {saving ? 'Speichern…' : isCreate ? 'Anlegen' : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      <PhotoLightbox
        fotos={editFotos}
        openId={lightboxId}
        onOpenIdChange={setLightboxId}
        imageSrc={optimierungFotoSrc}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Optimierung löschen?"
        description={
          item
            ? `„${item.titel}“ wird unwiderruflich gelöscht.`
            : 'Eintrag wird unwiderruflich gelöscht.'
        }
        confirmLabel="Löschen"
        onConfirm={handleDelete}
        isLoading={deleting}
      />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Optimierung verwerfen?"
        description={
          item
            ? `„${item.titel}“ wird als verworfen markiert und aus den offenen Listen ausgeblendet.`
            : 'Eintrag wird als verworfen markiert.'
        }
        confirmLabel="Verwerfen"
        variant="default"
        onConfirm={handleDiscard}
        isLoading={discarding}
      />
    </>
  )
}
