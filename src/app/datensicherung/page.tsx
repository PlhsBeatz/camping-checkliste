'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, Download, Upload, AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { BackupPreset } from '@/lib/data-backup'
import type { Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const PRESET_META: { id: BackupPreset; label: string; hint: string }[] = [
  { id: 'referenceCore', label: 'Referenz (Kategorien, Tags, Ausrüstung, …)', hint: 'Struktur ohne Urlaubs-Packlisten' },
  { id: 'vacations', label: 'Urlaube & dynamische Packliste', hint: 'urlaube, packlisten, zeilen, Mitverknüpfungen' },
  { id: 'places', label: 'Campingplätze & Fotos-Metadaten', hint: 'keine R2-Binarys' },
  { id: 'toolsChecklists', label: 'Tools-Checklisten', hint: 'separate Checklisten' },
]

export default function DatensicherungPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [presetState, setPresetState] = useState<Record<BackupPreset, boolean>>({
    referenceCore: false,
    vacations: false,
    places: false,
    toolsChecklists: false,
    auth: false,
  })
  /* auth-Preset nur per API; UI nutzt includeAuth */
  const [fullExport, setFullExport] = useState(true)
  const [selectedVacationIds, setSelectedVacationIds] = useState<Set<string>>(new Set())
  const [autoClosure, setAutoClosure] = useState(true)
  const [includeAuth, setIncludeAuth] = useState(false)
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
    const keys = Object.keys(presetState) as BackupPreset[]
    const p = keys.filter((k) => presetState[k])
    return p.length ? p : undefined
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
      }
      const res = await fetch('/api/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: unknown
        warnings?: string[]
        error?: string
      }
      if (!res.ok || !json.success || !json.data) {
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
  }, [selectedPresets, selectedVacationIds, autoClosure, includeAuth])

  const readFileJson = (file: File): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => {
        try {
          resolve(JSON.parse(String(r.result)))
        } catch (err) {
          reject(err)
        }
      }
      r.onerror = () => reject(r.error)
      r.readAsText(file, 'utf-8')
    })

  const runImport = async (dryRun: boolean, file: File | null) => {
    setImportReport(null)
    setMessage(null)
    if (!file) {
      setMessage('Bitte zuerst eine JSON-Datei wählen.')
      return
    }
    setBusy(true)
    try {
      const bundle = await readFileJson(file)
      const res = await fetch('/api/admin/data-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle, dryRun }),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: {
          warnings?: string[]
          errors?: string[]
          tablesWritten?: Record<string, number>
          dryRun?: boolean
        }
        error?: string
      }
      if (!res.ok) {
        setMessage(json.error ?? 'Import fehlgeschlagen')
        return
      }
      const d = json.data
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
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-3xl">
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
              <CardDescription>
                JSON-Backup mit <code className="text-xs">meta.formatVersion</code>. Ohne D1-Binding
                (reines <code className="text-xs">pnpm dev</code>) schlägt der Export fehl — nutze die
                Produktiv-/Preview-Umgebung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="full"
                  checked={fullExport}
                  onCheckedChange={(c) => setFullExport(c === true)}
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
                    Datei wie ein Geheimnis behandeln. Ohne diese Option bleiben die Auth-Tabellen im Export
                    leer.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Optional: nur bestimmte Urlaube</p>
                <p className="text-xs text-muted-foreground">
                  Wenn mindestens ein Urlaub gewählt ist, werden Packlisten-Daten darauf beschränkt. Ohne
                  „Referenzkern“ und mit Auto-Closure werden passende Ausrüstung/Kategorien mit exportiert.
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
                    Für Teil-Exports ohne Referenzkern bei ausgewählten Urlauben.
                  </p>
                </div>
              </div>

              <Button onClick={runExport} disabled={busy} className="gap-2">
                <Download className="h-4 w-4" />
                {busy ? 'Export…' : 'JSON herunterladen'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>
                <code className="text-xs">mergeById</code> per <code className="text-xs">INSERT OR REPLACE</code>.
                Bestehende Zeilen mit gleichem Primärschlüssel werden überschrieben; andere Zeilen werden nicht
                gelöscht.
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
        <span className="text-sm sr-only">Backup-JSON</span>
        <input
          type="file"
          accept="application/json,.json"
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
