'use client'

import { useCallback, useEffect, useState } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SmartSuggestionCard } from '@/components/smart-suggestion-card'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function VorschlaegePage() {
  const [showNav, setShowNav] = useState(false)
  const [items, setItems] = useState<SmartSuggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/suggestions')
    const json = (await res.json()) as ApiResponse<SmartSuggestion[]>
    if (json.success && json.data) {
      setItems(json.data)
      notifySmartSuggestionsChanged(json.data.length)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useReconnectRefetch(() => {
    void load()
  })

  const act = async (
    id: string,
    action: 'accept' | 'dismiss' | 'snooze',
    extra?: { url?: string }
  ) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          days: action === 'snooze' ? 7 : undefined,
          url: extra?.url,
        }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!json.success) {
        alert(json.error ?? 'Aktion fehlgeschlagen')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNav} onClose={() => setShowNav(false)} />
      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col gap-0">
          <div className="sticky top-0 z-30 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 mb-6">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNav(true)}
                className="lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Vorschläge
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Muster aus euren Packlisten und Campingplätzen – nichts wird still gespeichert.
                  „Später“ blendet einen Hinweis für 7 Tage aus.
                </p>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Vorschläge.</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((s) => (
                <SmartSuggestionCard
                  key={s.id}
                  suggestion={s}
                  busy={busyId === s.id}
                  onAct={(action, extra) => void act(s.id, action, extra)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
