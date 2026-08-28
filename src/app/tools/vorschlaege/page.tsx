'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SmartSuggestionCard } from '@/components/smart-suggestion-card'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { useSmartSuggestionAct } from '@/hooks/use-smart-suggestion-act'
import { useSuggestionFocusFlash, useSuggestionFocusId } from '@/hooks/use-suggestion-focus-flash'

function VorschlaegePageContent() {
  const focusId = useSuggestionFocusId()
  const [showNav, setShowNav] = useState(false)
  const [items, setItems] = useState<SmartSuggestion[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/suggestions', { cache: 'no-store' })
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

  const { busyId, act } = useSmartSuggestionAct(load)
  const focusReady = Boolean(focusId && items.some((s) => s.id === focusId))
  const flashing = useSuggestionFocusFlash(focusReady ? focusId : null)

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
            <div className="grid gap-4 xl:grid-cols-2 min-w-0">
              {items.map((s) => (
                <SmartSuggestionCard
                  key={s.id}
                  suggestion={s}
                  busy={busyId === s.id}
                  highlighted={flashing && s.id === focusId}
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

export default function VorschlaegePage() {
  return (
    <Suspense fallback={null}>
      <VorschlaegePageContent />
    </Suspense>
  )
}
