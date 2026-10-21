'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { SmartSuggestionCard } from '@/components/smart-suggestion-card'
import { BrandEmptyState } from '@/components/brand-empty-state'
import {
  EMPTY_ILLUSTRATION_CLASS,
  SuggestionsEmptyIllustration,
} from '@/components/brand-empty-illustrations'
import { TempPromoteEquipmentDialog } from '@/components/temp-promote-equipment-dialog'
import type { ApiResponse } from '@/lib/api-types'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { useSmartSuggestionAct } from '@/hooks/use-smart-suggestion-act'
import { useSuggestionFocusFlash, useSuggestionFocusId } from '@/hooks/use-suggestion-focus-flash'
import { useAuth } from '@/components/auth-provider'
import { useTempPromoteEquipment } from '@/hooks/use-temp-promote-equipment'

function VorschlaegePageContent() {
  const focusId = useSuggestionFocusId()
  const { canAccessConfig } = useAuth()
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

  const { opening, openingId, openForSuggestion, dialogState } = useTempPromoteEquipment({
    onCompleted: load,
  })

  const handleCardAct = useCallback(
    (suggestion: SmartSuggestion, action: 'accept' | 'dismiss' | 'snooze', extra?: { url?: string }) => {
      if (action === 'accept' && suggestion.kind === 'temp_promote' && canAccessConfig) {
        void openForSuggestion(suggestion)
        return
      }
      void act(suggestion.id, action, extra)
    },
    [act, canAccessConfig, openForSuggestion]
  )

  return (
    <PageShell
      containerClassName="flex flex-col min-h-screen gap-6"
      afterContent={
        canAccessConfig ? <TempPromoteEquipmentDialog state={dialogState} /> : null
      }
    >
      <PageHeader
        title="Vorschläge"
        subtitle={
          <>
            Muster aus euren Packlisten und Campingplätzen – nichts wird still gespeichert.
            „Später“ blendet einen Hinweis für 7 Tage aus.
          </>
        }
      />

      {items.length === 0 ? (
        <BrandEmptyState
          illustration={
            <SuggestionsEmptyIllustration className={EMPTY_ILLUSTRATION_CLASS} />
          }
          title="Alles im Lot"
          description="Gerade gibt es nichts zu prüfen. Sobald sich Muster aus euren Packlisten oder Campingplätzen ergeben, erscheinen die Hinweise hier."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 min-w-0">
          {items.map((s) => (
            <SmartSuggestionCard
              key={s.id}
              suggestion={s}
              busy={busyId === s.id || (opening && openingId === s.id)}
              highlighted={flashing && s.id === focusId}
              canCreateEquipment={canAccessConfig}
              onAct={(action, extra) => handleCardAct(s, action, extra)}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}

export default function VorschlaegePage() {
  return (
    <Suspense fallback={null}>
      <VorschlaegePageContent />
    </Suspense>
  )
}
