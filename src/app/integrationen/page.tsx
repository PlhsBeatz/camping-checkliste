'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Checkbox } from '@/components/ui/checkbox'
import { Menu, Copy, Trash2, Plus, Webhook, Key, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { TripStatusPayload } from '@/lib/trip-readiness'
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

export default function IntegrationenPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([])
  const [newTokenName, setNewTokenName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<IntegrationEventType[]>([
    ...ALL_INTEGRATION_EVENT_TYPES,
  ])
  const [liveStatus, setLiveStatus] = useState<TripStatusPayload | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const loadLiveStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/cron/daily', { method: 'POST' })
      const json = (await res.json()) as ApiResponse<TripStatusPayload>
      if (json.success && json.data) setLiveStatus(json.data)
    } catch {
      setLiveStatus(null)
    }
  }, [])

  useEffect(() => {
    if (!canAccessConfig) return
    void loadData()
    void loadLiveStatus()
  }, [canAccessConfig, loadData, loadLiveStatus])

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

  const createToken = async () => {
    if (!newTokenName.trim()) return
    setBusy(true)
    setMessage(null)
    setCreatedToken(null)
    try {
      const res = await fetch('/api/integrations/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      })
      const json = (await res.json()) as ApiResponse<{ token: string }>
      if (json.success && json.data?.token) {
        setCreatedToken(json.data.token)
        setNewTokenName('')
        await loadData()
        setMessage('Token erstellt — bitte jetzt kopieren, er wird nicht erneut angezeigt.')
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
      await loadData()
    } finally {
      setBusy(false)
    }
  }

  const createWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return
    setBusy(true)
    setMessage(null)
    setCreatedWebhookSecret(null)
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
        setNewWebhookName('')
        setNewWebhookUrl('')
        await loadData()
        setMessage('Webhook erstellt — Signing-Secret bitte jetzt kopieren.')
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
      await loadData()
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
    } finally {
      setBusy(false)
    }
  }

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text)
    setMessage('In Zwischenablage kopiert.')
  }

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
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
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
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                Integrationen
              </h1>
            </div>
          </div>

          <div className="space-y-6 pb-6">
        {message && (
          <div className="rounded-md border bg-white px-4 py-3 text-sm">{message}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API-Token
            </CardTitle>
            <CardDescription>
              Für REST-Abfragen durch Home Assistant, Node-RED o.ä. Header:{' '}
              <code className="text-xs">Authorization: Bearer &lt;token&gt;</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Name (z.B. Home Assistant)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={createToken} disabled={busy}>
                <Plus className="h-4 w-4 mr-1" />
                Token erstellen
              </Button>
            </div>
            {createdToken && (
              <div className="rounded border bg-amber-50 p-3 text-sm flex items-start gap-2">
                <code className="flex-1 break-all">{createdToken}</code>
                <Button variant="outline" size="icon" onClick={() => copyText(createdToken)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <ul className="space-y-2">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground ml-2">{t.token_prefix}…</span>
                    {t.last_used_at && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        zuletzt: {new Date(t.last_used_at).toLocaleString('de-DE')}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => revokeToken(t.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
              {tokens.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine aktiven Tokens.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks (Push)
            </CardTitle>
            <CardDescription>
              CloudEvents 1.0 per POST — z.B. Nabu-Casa-Webhook-URL aus Home Assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="wh-name">Name</Label>
                <Input
                  id="wh-name"
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wh-url">Webhook-URL</Label>
                <Input
                  id="wh-url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://hooks.nabu.casa/…"
                />
              </div>
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
            <Button onClick={createWebhook} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" />
              Webhook hinzufügen
            </Button>
            {createdWebhookSecret && (
              <div className="rounded border bg-amber-50 p-3 text-sm">
                <p className="font-medium mb-1">Signing-Secret (einmalig):</p>
                <div className="flex gap-2">
                  <code className="flex-1 break-all">{createdWebhookSecret}</code>
                  <Button variant="outline" size="icon" onClick={() => copyText(createdWebhookSecret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {webhooks.map((wh) => (
                <li key={wh.id} className="rounded border bg-white px-3 py-3 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{wh.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{wh.url}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => testWebhook(wh.id)} disabled={busy}>
                        Test
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleWebhookEnabled(wh)}>
                        {wh.enabled ? 'Aus' : 'An'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteWebhook(wh.id)} disabled={busy}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
              {webhooks.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Webhooks konfiguriert.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live-Status (Vorschau)</CardTitle>
            <CardDescription>Aktueller Integrations-JSON für den nächsten Urlaub</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="mb-3" onClick={loadLiveStatus} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Aktualisieren
            </Button>
            <pre className="text-xs bg-slate-950 text-slate-50 rounded p-3 overflow-auto max-h-80">
              {liveStatus ? JSON.stringify(liveStatus, null, 2) : 'Kein relevanter Urlaub'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API-Endpunkte</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>
              <code>GET /api/integrations/trip-status</code> — Status inkl.{' '}
              <code>ready_to_depart</code>
            </p>
            <p>
              <code>GET /api/integrations/trip-status/open-items</code> — offene Items
            </p>
            <p>
              <code>GET /api/integrations/vacations</code> — alle Urlaube mit Kurzstatus
            </p>
            <p className="pt-2">
              Ausführliche Home-Assistant-Anleitung:{' '}
              <code className="text-xs">docs/HOME_ASSISTANT.md</code>
            </p>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
