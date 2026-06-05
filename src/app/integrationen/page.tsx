'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Menu,
  Copy,
  Plus,
  Webhook,
  Key,
  RefreshCw,
  MoreVertical,
  ChevronDown,
  Power,
  PowerOff,
  Send,
  Eye,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { ALL_INTEGRATION_EVENT_TYPES, type IntegrationEventType } from '@/lib/integration-db'

type TokenRow = {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

type WebhookRow = {
  id: string
  name: string
  url: string
  enabled_events: IntegrationEventType[]
  enabled: boolean
  created_at: string
}

type PreviewEndpoint = 'trip-status' | 'open-items' | 'vacations'

const PREVIEW_ENDPOINTS: { id: PreviewEndpoint; label: string; path: string }[] = [
  { id: 'trip-status', label: 'Reise-Status', path: 'GET /api/integrations/trip-status' },
  { id: 'open-items', label: 'Offene Items', path: 'GET /api/integrations/trip-status/open-items' },
  { id: 'vacations', label: 'Alle Urlaube', path: 'GET /api/integrations/vacations' },
]

const EVENT_LABELS: Record<IntegrationEventType, string> = {
  'de.camping-packliste.packing.progress_changed': 'Pack-Fortschritt geändert',
  'de.camping-packliste.packing.complete': 'Packliste vollständig (abfahrbereit)',
  'de.camping-packliste.packing.incomplete': 'Packliste wieder unvollständig',
  'de.camping-packliste.trip.departure_approaching': 'Abreise naht (3/1 Tage)',
  'de.camping-packliste.trip.departure_day': 'Abreisetag',
  'de.camping-packliste.trip.started': 'Reise gestartet',
  'de.camping-packliste.trip.ended': 'Reise beendet',
  'de.camping-packliste.integration.test': 'Test-Event',
}

type DeleteTarget =
  | { kind: 'token'; id: string; name: string }
  | { kind: 'webhook'; id: string; name: string }

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-DE')
}

function ListRow({
  title,
  subtitle,
  badge,
  onOpen,
  menu,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  onOpen: () => void
  menu: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{title}</span>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </button>
      {menu}
    </li>
  )
}

export default function IntegrationenPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [createTokenOpen, setCreateTokenOpen] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)

  const [createWebhookOpen, setCreateWebhookOpen] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<IntegrationEventType[]>([
    ...ALL_INTEGRATION_EVENT_TYPES,
  ])

  const [detailToken, setDetailToken] = useState<TokenRow | null>(null)
  const [detailWebhook, setDetailWebhook] = useState<WebhookRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewEndpoint, setPreviewEndpoint] = useState<PreviewEndpoint>('trip-status')
  const [previewJson, setPreviewJson] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!loading && !canAccessConfig) router.replace('/')
  }, [loading, canAccessConfig, router])

  const loadData = useCallback(async () => {
    try {
      const [tokRes, whRes] = await Promise.all([
        fetch('/api/integrations/tokens'),
        fetch('/api/integrations/webhooks'),
      ])
      const tokJson = (await tokRes.json()) as ApiResponse<TokenRow[]>
      const whJson = (await whRes.json()) as ApiResponse<WebhookRow[]>
      if (tokJson.success && tokJson.data) setTokens(tokJson.data.filter((t) => !t.revoked_at))
      if (whJson.success && whJson.data) setWebhooks(whJson.data)
    } catch {
      setMessage('Daten konnten nicht geladen werden')
    }
  }, [])

  useEffect(() => {
    if (!canAccessConfig) return
    void loadData()
  }, [canAccessConfig, loadData])

  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showNavSidebar])

  const loadPreview = useCallback(async (endpoint: PreviewEndpoint) => {
    setPreviewLoading(true)
    try {
      const res = await fetch(
        `/api/integrations/preview?endpoint=${encodeURIComponent(endpoint)}`
      )
      const json = (await res.json()) as ApiResponse<unknown>
      if (json.success && json.data !== undefined) {
        setPreviewJson(JSON.stringify(json.data, null, 2))
      } else {
        setPreviewJson(json.error ? JSON.stringify({ error: json.error }, null, 2) : null)
      }
    } catch {
      setPreviewJson(null)
      setMessage('Vorschau konnte nicht geladen werden')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (previewOpen) void loadPreview(previewEndpoint)
  }, [previewOpen, previewEndpoint, loadPreview])

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text)
    setMessage('In Zwischenablage kopiert.')
  }

  const resetCreateTokenForm = () => {
    setNewTokenName('')
    setCreatedToken(null)
  }

  const resetCreateWebhookForm = () => {
    setNewWebhookName('')
    setNewWebhookUrl('')
    setCreatedWebhookSecret(null)
    setSelectedEvents([...ALL_INTEGRATION_EVENT_TYPES])
  }

  const createToken = async () => {
    if (!newTokenName.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      })
      const json = (await res.json()) as ApiResponse<{ token: string }>
      if (json.success && json.data?.token) {
        setCreatedToken(json.data.token)
        await loadData()
      } else {
        setMessage(json.error ?? 'Fehler beim Erstellen')
      }
    } catch {
      setMessage('Fehler beim Erstellen des Tokens')
    } finally {
      setBusy(false)
    }
  }

  const revokeToken = async (id: string) => {
    setBusy(true)
    try {
      await fetch(`/api/integrations/tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setDetailToken(null)
      await loadData()
      setMessage('Token widerrufen.')
    } finally {
      setBusy(false)
    }
  }

  const createWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWebhookName.trim(),
          url: newWebhookUrl.trim(),
          enabled_events: selectedEvents,
        }),
      })
      const json = (await res.json()) as ApiResponse<{ signing_secret: string }>
      if (json.success && json.data?.signing_secret) {
        setCreatedWebhookSecret(json.data.signing_secret)
        await loadData()
      } else {
        setMessage(json.error ?? 'Fehler beim Erstellen')
      }
    } catch {
      setMessage('Fehler beim Erstellen des Webhooks')
    } finally {
      setBusy(false)
    }
  }

  const deleteWebhook = async (id: string) => {
    setBusy(true)
    try {
      await fetch(`/api/integrations/webhooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setDetailWebhook(null)
      await loadData()
      setMessage('Webhook gelöscht.')
    } finally {
      setBusy(false)
    }
  }

  const testWebhook = async (id: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'test' }),
      })
      const json = (await res.json()) as ApiResponse<{ success: boolean; error: string | null }>
      if (json.success && json.data?.success) {
        setMessage('Test-Webhook erfolgreich zugestellt.')
      } else {
        setMessage(json.data?.error ?? json.error ?? 'Test fehlgeschlagen')
      }
    } catch {
      setMessage('Test fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const toggleWebhookEnabled = async (wh: WebhookRow) => {
    setBusy(true)
    try {
      await fetch('/api/integrations/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wh.id, enabled: !wh.enabled }),
      })
      await loadData()
      if (detailWebhook?.id === wh.id) {
        setDetailWebhook({ ...wh, enabled: !wh.enabled })
      }
      setMessage(wh.enabled ? 'Webhook deaktiviert.' : 'Webhook aktiviert.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'token') await revokeToken(deleteTarget.id)
    else await deleteWebhook(deleteTarget.id)
    setDeleteTarget(null)
  }

  const tokenMenu = (t: TokenRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Aktionen">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetailToken(t)}>
          <Eye className="h-4 w-4 mr-2" />
          Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setDeleteTarget({ kind: 'token', id: t.id, name: t.name })}
        >
          Widerrufen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const webhookMenu = (wh: WebhookRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Aktionen">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetailWebhook(wh)}>
          <Eye className="h-4 w-4 mr-2" />
          Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => testWebhook(wh.id)} disabled={busy || !wh.enabled}>
          <Send className="h-4 w-4 mr-2" />
          Test senden
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleWebhookEnabled(wh)} disabled={busy}>
          {wh.enabled ? (
            <>
              <PowerOff className="h-4 w-4 mr-2" />
              Deaktivieren
            </>
          ) : (
            <>
              <Power className="h-4 w-4 mr-2" />
              Aktivieren
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setDeleteTarget({ kind: 'webhook', id: wh.id, name: wh.name })}
        >
          Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (loading || !canAccessConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Laden…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
                aria-label="Menü"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                Integrationen
              </h1>
            </div>
          </div>

          <div className="space-y-6 pb-6">
            {message && (
              <div className="rounded-md border bg-card px-4 py-3 text-sm flex items-start justify-between gap-2">
                <span>{message}</span>
                <Button variant="ghost" size="sm" className="shrink-0 h-7" onClick={() => setMessage(null)}>
                  OK
                </Button>
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Key className="h-5 w-5" />
                    API-Token
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    REST-Zugriff mit{' '}
                    <code className="text-xs">Authorization: Bearer …</code>
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    resetCreateTokenForm()
                    setCreateTokenOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Token erstellen
                </Button>
              </CardHeader>
              <CardContent>
                {tokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Noch keine aktiven Tokens.</p>
                ) : (
                  <ul className="space-y-2">
                    {tokens.map((t) => (
                      <ListRow
                        key={t.id}
                        title={t.name}
                        subtitle={`${t.token_prefix}…`}
                        onOpen={() => setDetailToken(t)}
                        menu={tokenMenu(t)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Webhook className="h-5 w-5" />
                    Webhooks
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Push-Benachrichtigungen (CloudEvents) an z. B. Home Assistant
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    resetCreateWebhookForm()
                    setCreateWebhookOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Webhook hinzufügen
                </Button>
              </CardHeader>
              <CardContent>
                {webhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Noch keine Webhooks.</p>
                ) : (
                  <ul className="space-y-2">
                    {webhooks.map((wh) => (
                      <ListRow
                        key={wh.id}
                        title={wh.name}
                        badge={
                          <Badge variant={wh.enabled ? 'default' : 'secondary'} className="text-xs">
                            {wh.enabled ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        }
                        onOpen={() => setDetailWebhook(wh)}
                        menu={webhookMenu(wh)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left px-6 py-4 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors rounded-t-lg"
                  >
                    <div>
                      <p className="font-semibold text-base">API-Vorschau</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Beispielantworten der Integrations-Endpunkte (Admin-Vorschau)
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                        previewOpen && 'rotate-180'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground block">Endpunkt</Label>
                      <div className="flex flex-wrap gap-3 items-center mt-1.5">
                        <div className="flex-1 min-w-[200px] max-w-md">
                          <Select
                            value={previewEndpoint}
                            onValueChange={(v) => setPreviewEndpoint(v as PreviewEndpoint)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PREVIEW_ENDPOINTS.map((ep) => (
                                <SelectItem key={ep.id} value={ep.id}>
                                  {ep.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => loadPreview(previewEndpoint)}
                          disabled={previewLoading}
                        >
                          <RefreshCw
                            className={cn('h-4 w-4 mr-1', previewLoading && 'animate-spin')}
                          />
                          Aktualisieren
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                        {PREVIEW_ENDPOINTS.find((e) => e.id === previewEndpoint)?.path}
                      </p>
                    </div>
                    <pre className="text-xs bg-slate-950 text-slate-50 rounded-lg p-3 overflow-auto max-h-96">
                      {previewLoading
                        ? 'Laden…'
                        : previewJson ?? 'Keine Daten'}
                    </pre>
                    <p className="text-xs text-muted-foreground">
                      Dokumentation: <code>docs/HOME_ASSISTANT.md</code>
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Token erstellen */}
      <ResponsiveModal
        open={createTokenOpen}
        onOpenChange={(open) => {
          setCreateTokenOpen(open)
          if (!open) resetCreateTokenForm()
        }}
        title={createdToken ? 'Token erstellt' : 'API-Token erstellen'}
        description={
          createdToken
            ? 'Kopiere den Token jetzt — er wird nicht erneut angezeigt.'
            : 'Name für die Zuordnung (z. B. Home Assistant).'
        }
      >
        {createdToken ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-amber-50 p-3 flex gap-2">
              <code className="flex-1 break-all text-sm">{createdToken}</code>
              <Button variant="outline" size="icon" onClick={() => copyText(createdToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => setCreateTokenOpen(false)}>
              Fertig
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Home Assistant"
                className="mt-1.5"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateTokenOpen(false)} disabled={busy}>
                Abbrechen
              </Button>
              <Button onClick={createToken} disabled={busy || !newTokenName.trim()}>
                Erstellen
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Webhook erstellen */}
      <ResponsiveModal
        open={createWebhookOpen}
        onOpenChange={(open) => {
          setCreateWebhookOpen(open)
          if (!open) resetCreateWebhookForm()
        }}
        title={createdWebhookSecret ? 'Webhook erstellt' : 'Webhook hinzufügen'}
        description={
          createdWebhookSecret
            ? 'Signing-Secret einmalig kopieren (optional für HMAC-Prüfung).'
            : 'Nabu-Casa- oder andere Webhook-URL aus dem Zielsystem.'
        }
        contentClassName="max-h-[85vh]"
      >
        {createdWebhookSecret ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-amber-50 p-3 flex gap-2">
              <code className="flex-1 break-all text-sm">{createdWebhookSecret}</code>
              <Button variant="outline" size="icon" onClick={() => copyText(createdWebhookSecret)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => setCreateWebhookOpen(false)}>
              Fertig
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="wh-url">Webhook-URL</Label>
              <Input
                id="wh-url"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://hooks.nabu.casa/…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="mb-2 block">Events</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_INTEGRATION_EVENT_TYPES.filter(
                  (e) => e !== 'de.camping-packliste.integration.test'
                ).map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedEvents.includes(ev)}
                      onCheckedChange={(checked) => {
                        setSelectedEvents((prev) =>
                          checked ? [...prev, ev] : prev.filter((x) => x !== ev)
                        )
                      }}
                    />
                    {EVENT_LABELS[ev]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateWebhookOpen(false)} disabled={busy}>
                Abbrechen
              </Button>
              <Button
                onClick={createWebhook}
                disabled={busy || !newWebhookName.trim() || !newWebhookUrl.trim()}
              >
                Erstellen
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Token Details */}
      <ResponsiveModal
        open={!!detailToken}
        onOpenChange={(open) => !open && setDetailToken(null)}
        title={detailToken?.name ?? 'Token'}
        description="API-Token Details"
      >
        {detailToken && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Präfix</dt>
              <dd className="font-mono mt-0.5">{detailToken.token_prefix}…</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Erstellt</dt>
              <dd className="mt-0.5">{formatDateTime(detailToken.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zuletzt verwendet</dt>
              <dd className="mt-0.5">{formatDateTime(detailToken.last_used_at)}</dd>
            </div>
          </dl>
        )}
      </ResponsiveModal>

      {/* Webhook Details */}
      <ResponsiveModal
        open={!!detailWebhook}
        onOpenChange={(open) => !open && setDetailWebhook(null)}
        title={detailWebhook?.name ?? 'Webhook'}
        description="Webhook-Konfiguration"
        contentClassName="max-h-[85vh]"
      >
        {detailWebhook && (
          <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant={detailWebhook.enabled ? 'default' : 'secondary'} className="mt-1">
                {detailWebhook.enabled ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">URL</p>
              <p className="font-mono text-xs break-all mt-1">{detailWebhook.url}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Erstellt</p>
              <p className="mt-0.5">{formatDateTime(detailWebhook.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Events</p>
              <ul className="space-y-1">
                {detailWebhook.enabled_events.map((ev) => (
                  <li key={ev} className="text-xs">
                    {EVENT_LABELS[ev] ?? ev}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.kind === 'token' ? 'Token widerrufen?' : 'Webhook löschen?'}
        description={
          deleteTarget
            ? `„${deleteTarget.name}" wirklich ${deleteTarget.kind === 'token' ? 'widerrufen' : 'löschen'}? Diese Aktion kann nicht rückgängig gemacht werden.`
            : ''
        }
        confirmLabel={deleteTarget?.kind === 'token' ? 'Widerrufen' : 'Löschen'}
        loadingLabel={deleteTarget?.kind === 'token' ? 'Wird widerrufen…' : 'Wird gelöscht…'}
        onConfirm={handleConfirmDelete}
        isLoading={busy}
      />
    </div>
  )
}
