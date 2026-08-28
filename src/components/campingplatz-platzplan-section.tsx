'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SmartSuggestionCard } from '@/components/smart-suggestion-card'
import { useSmartSuggestionAct } from '@/hooks/use-smart-suggestion-act'
import { useSuggestionFocusFlash, useSuggestionFocusId } from '@/hooks/use-suggestion-focus-flash'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import type { ApiResponse } from '@/lib/api-types'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged, SMART_SUGGESTIONS_CHANGED_EVENT } from '@/lib/smart-suggestions-events'
import { PLATZPLAN_SECTION_ID, suggestionDomId } from '@/lib/smart-suggestion-focus'

export function CampingplatzPlatzplanSection({
  campingplatzId,
  platzplanUrl,
  platzplanHinweis,
  canManage,
  onRefresh,
}: {
  campingplatzId: string
  platzplanUrl: string | null
  platzplanHinweis: string | null | undefined
  canManage: boolean
  onRefresh: () => Promise<void>
}) {
  const highlightId = useSuggestionFocusId()
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null)
  const [fromPlatzplanHash, setFromPlatzplanHash] = useState(false)

  const loadSuggestion = useCallback(async () => {
    if (!canManage || platzplanUrl) {
      setSuggestion(null)
      return
    }
    try {
      const res = await fetch(
        `/api/suggestions?kind=platzplan&kontextId=${encodeURIComponent(campingplatzId)}`,
        { cache: 'no-store' }
      )
      const json = (await res.json()) as ApiResponse<SmartSuggestion[]>
      setSuggestion(json.success && json.data?.[0] ? json.data[0] : null)
    } catch {
      setSuggestion(null)
    }
  }, [campingplatzId, canManage, platzplanUrl])

  useEffect(() => {
    void loadSuggestion()
  }, [loadSuggestion])

  useEffect(() => {
    const onChange = () => {
      void loadSuggestion()
    }
    window.addEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
  }, [loadSuggestion])

  useEffect(() => {
    setFromPlatzplanHash(window.location.hash === `#${PLATZPLAN_SECTION_ID}`)
  }, [campingplatzId])

  useReconnectRefetch(() => {
    void loadSuggestion()
  })

  const afterAct = useCallback(async () => {
    notifySmartSuggestionsChanged()
    await onRefresh()
    await loadSuggestion()
  }, [loadSuggestion, onRefresh])

  const { busyId, act } = useSmartSuggestionAct(afterAct)
  const flashId = highlightId || (fromPlatzplanHash && suggestion ? suggestion.id : null)
  const flashing = useSuggestionFocusFlash(suggestion && flashId === suggestion.id ? flashId : null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== `#${PLATZPLAN_SECTION_ID}`) return
    const targetId = suggestion ? suggestionDomId(suggestion.id) : PLATZPLAN_SECTION_ID
    const t = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [campingplatzId, suggestion, platzplanUrl])

  const hint = platzplanHinweis?.trim() ?? ''

  return (
    <section id={PLATZPLAN_SECTION_ID} className="space-y-2 scroll-mt-28">
      <h2 className="text-sm font-semibold text-brand-heading">Platzplan</h2>
      {platzplanUrl ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-7 gap-1.5 bg-card px-2.5 text-xs hover:bg-neutral-50"
            asChild
          >
            <a href={platzplanUrl} target="_blank" rel="noopener noreferrer">
              <Map className="h-3.5 w-3.5 shrink-0" />
              Platzplan öffnen
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </Button>
          {hint ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{hint}</p>
          ) : null}
        </div>
      ) : suggestion ? (
        <SmartSuggestionCard
          suggestion={suggestion}
          busy={busyId === suggestion.id}
          highlighted={flashing}
          onAct={(action, extra) => void act(suggestion.id, action, extra)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Noch kein Platzplan hinterlegt.
          {hint ? ` ${hint}` : ''}
        </p>
      )}
    </section>
  )
}
