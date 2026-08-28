'use client'

import { useCallback, useEffect, useState } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

const KIND_LABEL: Record<string, string> = {
  packing_add: 'Packliste',
  packing_copack: 'Packliste',
  temp_promote: 'Ausrüstung',
  xor_candidate: 'Alternative',
  platzplan: 'Platzplan',
  place_gap: 'Campingplatz',
}

export default function VorschlaegePage() {
  const [showNav, setShowNav] = useState(false)
  const [items, setItems] = useState<SmartSuggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/suggestions')
    const json = (await res.json()) as ApiResponse<SmartSuggestion[]>
    if (json.success && json.data) setItems(json.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useReconnectRefetch(() => {
    void load()
  })

  const act = async (id: string, action: 'accept' | 'dismiss' | 'snooze') => {
    setBusyId(id)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days: action === 'snooze' ? 7 : undefined }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!json.success) {
        alert(json.error ?? 'Aktion fehlgeschlagen')
        return
      }
      notifySmartSuggestionsChanged()
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNav} onClose={() => setShowNav(false)} />
      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 max-w-3xl">
          <div className="sticky top-0 z-30 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNav(true)}
                className="lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Vorschläge
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Muster aus euren Packlisten und Campingplätzen – nichts wird still gespeichert.
                </p>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Vorschläge.</p>
          ) : (
            <div className="space-y-3">
              {items.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5">
                        {KIND_LABEL[s.kind] ?? s.kind}
                      </span>
                      <span>{s.titel}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {s.begruendung && (
                      <p className="text-sm text-muted-foreground">{s.begruendung}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, 'accept')}
                      >
                        Übernehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, 'snooze')}
                      >
                        Später
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, 'dismiss')}
                      >
                        Verwerfen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
