'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, Download, Upload, AlertTriangle, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { BackupPreset } from '@/lib/data-backup'
import type { Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** Presets in der UI (ohne Legacy referenceCore und ohne separates auth-Preset) */
type UiPresetKey = Exclude<BackupPreset, 'referenceCore' | 'auth'>

const PRESET_META: { id: UiPresetKey; label: string; hint: string }[] = [
  {
    id: 'equipment',
    label: 'Ausrüstung',
    hint:
      'Ausrüstungsgegenstände mit externen Links, Tag-Zuordnungen sowie fest zugeordneten Mitreisenden je Gegenstand.',
  },
  {
    id: 'referenceStammdaten',
    label: 'Packliste-Stamm & Organisation',
    hint:
      'Hauptkategorien und Kategorien der Packliste, Transportmittel inkl. manueller Festgewichte „Fest eingebaut“, Tag-Kategorien und Tags (Labels), Mitreisende-Stammdaten, Packlisten-Vorlagen mit Vorlagen-Einträgen.',
  },
  {
    id: 'vacations',
    label: 'Urlaube & dynamische Packliste',
    hint:
      'Urlaubs-Stammdaten; Zuordnung von Mitreisenden und Campingplätzen zum Urlaub; eine Packliste pro Urlaub mit allen Einträgen (über Ausrüstung oder temporär); Zuordnung Mitreisende je Eintrag (wer/wie viele/welches Transportmittel).',
  },
  {
    id: 'places',
    label: 'Campingplätze',
    hint:
      'Campingplatz-Stammdaten, Zuordnung Urlaub↔Campingplatz und Fotometadaten; Binärdateien nur mit Option „R2-Bilder im ZIP“. ',
  },
  {
    id: 'toolsChecklists',
    label: 'Tools / Checklisten',
    hint: 'Die zusätzlichen Checklisten unter „Tools“ mit Kategorien und Einträgen.',
  },
]

function emptyUiPresetState(): Record<UiPresetKey, boolean> {
  return {
    equipment: false,
    referenceStammdaten: false,
    vacations: false,
    places: false,
    toolsChecklists: false,
  }
}

export default function DatensicherungPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [presetState, setPresetState] = useState<Record<UiPresetKey, boolean>>(emptyUiPresetState)
  /* auth-Preset nur per API; UI nutzt includeAuth */
  const [fullExport, setFullExport] = useState(true)
  const [selectedVacationIds, setSelectedVacationIds] = useState<Set<string>>(new Set())
  const [vacationPickerOpen, setVacationPickerOpen] = useState(false)
  const [autoClosure, setAutoClosure] = useState(true)
  const [includeAuth, setIncludeAuth] = useState(false)
  const [includeR2Photos, setIncludeR2Photos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [importReport, setImportReport] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !canAccessConfig) router.replace('/')
  }, [loading, canAccessConfig, router])

  useEffect(() => {
    if (!canAccessConfig) return
    void (async () => {
      try {
        const res = await fetch('/api/vacations')
        const json = (await res.json()) as ApiResponse<Vacation[]>
        if (json.success && json.data) setVacations(json.data)
      } catch {
        setVacations([])
      }
    })()
  }, [canAccessConfig])

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

  const selectedPresets = useMemo((): BackupPreset[] | undefined => {
    if (fullExport) return undefined
    const keys = (Object.keys(presetState) as UiPresetKey[]).filter((k) => presetState[k])
    return keys.length ? keys : undefined
  }, [fullExport, presetState])

  const toggleVac = (id: string) => {
    setSelectedVacationIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const runExport = useCallback(async () => {
    setMessage(null)
    setBusy(true)
    try {
      const body = {
        presets: selectedPresets,
        vacationIds:
          selectedVacationIds.size > 0 ? [...selectedVacationIds] : undefined,
        autoClosure,
        includeAuth,
        includeR2Photos,
      }
      const res = await fetch('/api/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string }
        setMessage(errJson.error ?? `Export fehlgeschlagen (${res.status})`)
        return
      }
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/zip')) {
        const ab = await res.arrayBuffer()
        const blob = new Blob([ab], { type: 'application/zip' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `camping-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`
        a.click()
        URL.revokeObjectURL(a.href)
        let warnHint = ''
        try {
          const { unzipSync, strFromU8 } = await import('fflate')
          const u = unzipSync(new Uint8Array(ab))
          const rawMeta = u['export-meta.json']
          if (rawMeta) {
            const meta = JSON.parse(strFromU8(rawMeta)) as { warnings?: string[] }
            if (meta.warnings?.length) {
              warnHint = ` Hinweise: ${meta.warnings.slice(0, 3).join(' — ')}`
            }
          }
        } catch {
          /* meta optional */
        }
        setMessage(`Export OK (ZIP mit Bildern).${warnHint}`)
        return
      }
      const json = (await res.json()) as {
        success?: boolean
        data?: unknown
        warnings?: string[]
        error?: string
      }
      if (!json.success || !json.data) {
        setMessage(json.error ?? 'Export fehlgeschlagen')
        return
      }
      const blob = new Blob([JSON.stringify(json.data, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `camping-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setMessage(
        `Export OK.${json.warnings?.length ? ` Hinweise: ${json.warnings.slice(0, 3).join(' — ')}` : ''}`
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [selectedPresets, selectedVacationIds, autoClosure, includeAuth, includeR2Photos])

  const runImport = async (dryRun: boolean, file: File | null) => {
    setImportReport(null)
    setMessage(null)
    if (!file) {
      setMessage('Bitte zuerst eine Datei wählen (.json oder .zip).')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('dryRun', dryRun ? 'true' : 'false')
      const res = await fetch('/api/admin/data-import', {
        method: 'POST',
        body: fd,
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: {
          warnings?: string[]
          errors?: string[]
          tablesWritten?: Record<string, number>
          dryRun?: boolean
          r2ObjectsWritten?: number
        }
        error?: string
      }
      if (!res.ok) {
        setMessage(json.error ?? 'Import fehlgeschlagen')
        return
      }
      const d = json.data
      const r2Line =
        dryRun || d?.r2ObjectsWritten === undefined
          ? ''
          : d.r2ObjectsWritten > 0
            ? `R2: ${d.r2ObjectsWritten} Objekt(e) nach CAMPING_PHOTOS geschrieben.`
            : 'R2: keine Objekte geschrieben (Backup ohne Binärteil oder Fehler — siehe Warnungen).'
      const lines = [
        dryRun ? '(Probelauf — keine Schreibvorgänge)' : 'Import ausgeführt.',
        d?.errors?.length ? `Fehler (${d.errors.length}): ${d.errors.slice(0, 8).join('; ')}` : 'Keine DB-Fehler.',
        d?.warnings?.length ? `Warnungen (${d.warnings.length}): ${d.warnings.slice(0, 12).join(' | ')}` : '',
        d?.tablesWritten
          ? `Zeilen je Tabelle: ${Object.entries(d.tablesWritten)
              .filter(([, n]) => n > 0)
              .map(([t, n]) => `${t}:${n}`)
              .join(', ')}`
          : '',
        r2Line,
      ]
      setImportReport(lines.filter(Boolean).join('\n\n'))
      if (!dryRun && json.success) setMessage('Import abgeschlossen.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !canAccessConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />
      <div
        className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}
      >
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0"
                onClick={() => setShowNavSidebar(true)}
                aria-label="Menü"
              >
                <Menu className="h-6 w-6" />
              </Button>
              <h1 className="text-xl font-semibold text-[rgb(45,79,30)] truncate tracking-tight">
                Datensicherung
              </h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="full"
                  checked={fullExport}
                  onCheckedChange={(c) => {
                    const on = c === true
                    setFullExport(on)
                    if (on) {
                      setPresetState(emptyUiPresetState())
                      setSelectedVacationIds(new Set())
                      setVacationPickerOpen(false)
                    }
                  }}
                />
                <div>
                  <Label htmlFor="full" className="font-medium">
                    Komplettexport (alle Bereiche)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Entspricht allen Tabellen; Auth optional (siehe unten).
                  </p>
                </div>
              </div>

              {!fullExport && (
                <div className="space-y-3 pl-1">
                  <p className="text-sm font-medium">Bereiche kombinieren</p>
                  {PRESET_META.map((p) => (
                    <div key={p.id} className="flex items-start gap-2">
                      <Checkbox
                        id={p.id}
                        checked={presetState[p.id]}
                        onCheckedChange={(c) =>
                          setPresetState((s) => ({ ...s, [p.id]: c === true }))
                        }
                      />
                      <div>
                        <Label htmlFor={p.id} className="font-medium">
                          {p.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{p.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="inclR2"
                  checked={includeR2Photos}
                  onCheckedChange={(c) => setIncludeR2Photos(c === true)}
                />
                <div>
                  <Label htmlFor="inclR2" className="font-medium">
                    R2-Bilder im Backup (ZIP mit JSON + Dateien)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Liest die Dateien aus <code className="text-xs">CAMPING_PHOTOS</code> und packt sie in eine ZIP
                    zusammen mit <code className="text-xs">backup.json</code>. Ohne diese Option erhalten Sie nur die
                    reine JSON-Datei. Beim Import werden ZIP und reine JSON automatisch erkannt.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="inclAuth"
                  checked={includeAuth}
                  onCheckedChange={(c) => setIncludeAuth(c === true)}
                />
                <div>
                  <Label htmlFor="inclAuth" className="font-medium flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Authentifizierung exportieren (Passwort-Hashes, Einladungs-Tokens)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Datei wie ein Geheimnis behandeln. Ohne diese Option bleiben im Komplettexport die
                    Tabellen <code className="text-xs">users</code> u. a.{' '}
                    <strong className="font-medium text-foreground">absichtlich leer</strong>, auch wenn in
                    der Cloud mehrere Konten existieren – die JSON enthält dann keine Login-Datensätze.
                    Nur mit Login haben Personen eine Zeile unter <code className="text-xs">users</code>;
                    übrige Familienmitglieder stehen nur unter <code className="text-xs">mitreisende</code>.
                    Mit Häkchen werden <strong className="font-medium text-foreground">alle</strong> Konten
                    aus genau der Datenbank exportiert, die auch diese App gerade nutzt (nicht: andere
                    Umgebung / anderes <code className="text-xs">wrangler</code>-Projekt).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Collapsible open={vacationPickerOpen} onOpenChange={setVacationPickerOpen}>
                  <CollapsibleTrigger
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-left text-sm font-medium',
                      'hover:bg-secondary hover:text-secondary-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                  >
                    <span>
                      Bestimmte Urlaube einschränken
                      {selectedVacationIds.size > 0 ? ` (${selectedVacationIds.size} gewählt)` : ''}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        vacationPickerOpen && 'rotate-180'
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3">
                    <p className="text-xs text-muted-foreground">
                      Wenn mindestens ein Urlaub gewählt ist, werden die Urlaubs- und Packlisten-Daten im Export
                      darauf begrenzt. Ohne aktiviertes „Packliste-Stamm &amp; Organisation“ oder „Ausrüstung“
                      ergänzt die Option „Auto-Closure“ die dafür nötigen Referenzzeilen automatisch.
                    </p>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2 text-sm">
                      {vacations.length === 0 ? (
                        <span className="text-muted-foreground">Keine Urlaube geladen.</span>
                      ) : (
                        vacations.map((v) => (
                          <div key={v.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`v-${v.id}`}
                              checked={selectedVacationIds.has(v.id)}
                              onCheckedChange={() => toggleVac(v.id)}
                            />
                            <Label htmlFor={`v-${v.id}`} className="cursor-pointer font-normal">
                              {v.titel}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="closure"
                  checked={autoClosure}
                  onCheckedChange={(c) => setAutoClosure(c === true)}
                  disabled={fullExport}
                />
                <div>
                  <Label htmlFor="closure" className="font-medium">
                    Auto-Closure (referenzierte Ausrüstung &amp; Struktur)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Wenn Sie nur einzelne Urlaube exportieren und weder „Packliste-Stamm &amp; Organisation“
                    noch „Ausrüstung“ anhaken, werden fehlende referenzierte Tabellen automatisch ergänzt
                    (damit der Import konsistent bleibt).
                  </p>
                </div>
              </div>

              <Button onClick={runExport} disabled={busy} className="gap-2">
                <Download className="h-4 w-4" />
                {busy ? 'Export…' : includeR2Photos ? 'Backup laden (JSON oder ZIP)' : 'JSON herunterladen'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Camping-Fotos (Bestand)</CardTitle>
              <CardDescription>
                Bereits in R2 gespeicherte Bilder einmalig als WebP mit max. 1600 px und 85&nbsp;% Qualität neu encodieren
                (kleinere Speicherbelegung). Neue Uploads werden automatisch so gespeichert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReoptimizeFotosButton disabled={busy} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>
                <code className="text-xs">mergeById</code> per UPSERT (<code className="text-xs">
                  INSERT … ON CONFLICT DO UPDATE
                </code>
                ). Bestehende Zeilen mit gleichem Primärschlüssel werden zusammengeführt; es werden keine
                Zeilen automatisch gelöscht.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImportFileControls
                busy={busy}
                onDryRun={(file) => runImport(true, file)}
                onImport={(file) => {
                  if (
                    typeof window !== 'undefined' &&
                    !window.confirm(
                      'Import wirklich ausführen? Überschreibt Datensätze mit gleicher ID.'
                    )
                  ) {
                    return
                  }
                  runImport(false, file)
                }}
              />
              {importReport && (
                <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-3 border">
                  {importReport}
                </pre>
              )}
            </CardContent>
          </Card>

          {message && (
            <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ReoptimizeFotosButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  const run = async (dry: boolean) => {
    if (
      !dry &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Alle vorhandenen Camping-Fotos in R2 neu encodieren und ggf. alte Objekte ersetzen?'
      )
    ) {
      return
    }
    setLoading(true)
    setReport(null)
    try {
      const res = await fetch('/api/admin/camping-fotos/reoptimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: dry }),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: {
          dryRun?: boolean
          processed?: number
          skipped?: number
          total?: number
          errors?: string[]
          bytesBefore?: number
          bytesAfter?: number
        }
        error?: string
      }
      if (!res.ok) {
        setReport(json.error ?? `Fehler (${res.status})`)
        return
      }
      const d = json.data
      setReport(
        `${d?.dryRun ? '(Probelauf) ' : ''}Bearbeitet: ${d?.processed ?? 0}, übersprungen: ${d?.skipped ?? 0}, Einträge mit R2: ${d?.total ?? 0}. Bytes vorher: ${d?.bytesBefore ?? 0}, danach: ${d?.bytesAfter ?? 0}.${d?.errors?.length ? ` | Hinweise: ${d.errors.slice(0, 6).join('; ')}` : ''}`
      )
    } catch (e) {
      setReport(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => void run(true)}>
          Probelauf
        </Button>
        <Button type="button" disabled={disabled || loading} onClick={() => void run(false)}>
          Bestand neu komprimieren
        </Button>
      </div>
      {report && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{report}</p>}
    </div>
  )
}

function ImportFileControls({
  busy,
  onDryRun,
  onImport,
}: {
  busy: boolean
  onDryRun: (file: File | null) => void
  onImport: (file: File | null) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="text-sm sr-only">Backup-Datei</span>
        <input
          type="file"
          accept="application/json,.json,application/zip,.zip"
          className="text-sm max-w-[220px]"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        variant="outline"
        disabled={busy}
        className="gap-2"
        onClick={() => onDryRun(file)}
      >
        <Upload className="h-4 w-4" />
        Probelauf
      </Button>
      <Button variant="default" disabled={busy} className="gap-2" onClick={() => onImport(file)}>
        Importieren
      </Button>
    </div>
  )
}
