'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { suggestionDomId } from '@/lib/smart-suggestion-focus'
import {
  acceptButtonLabel,
  acceptConsequence,
  displayBegruendung,
  packingAddSeasonHint,
  packingTargetVacation,
  platzplanChoices,
} from '@/lib/smart-suggestion-copy'

const KIND_LABEL: Record<string, string> = {
  packing_add: 'Packliste',
  packing_copack: 'Packliste',
  temp_promote: 'Ausrüstung',
  xor_candidate: 'Alternative',
  platzplan: 'Platzplan',
  place_gap: 'Campingplatz',
}

export function SmartSuggestionCard({
  suggestion,
  busy,
  highlighted = false,
  onAct,
}: {
  suggestion: SmartSuggestion
  busy: boolean
  highlighted?: boolean
  onAct: (action: 'accept' | 'dismiss' | 'snooze', extra?: { url?: string }) => void
}) {
  const choices = useMemo(() => platzplanChoices(suggestion), [suggestion])
  const [chosenUrl, setChosenUrl] = useState(choices[0]?.url ?? '')
  useEffect(() => {
    if (choices.length === 0) {
      setChosenUrl('')
      return
    }
    setChosenUrl((prev) => (choices.some((c) => c.url === prev) ? prev : (choices[0]?.url ?? '')))
  }, [choices])
  const xorNames = Array.isArray(suggestion.payload.names)
    ? suggestion.payload.names.map(String)
    : []
  const vacationName = packingTargetVacation(suggestion)
  const seasonHint = packingAddSeasonHint(suggestion)

  return (
    <Card
      id={suggestionDomId(suggestion.id)}
      className={cn(
        'h-full min-w-0 max-w-full overflow-hidden scroll-mt-28',
        highlighted && 'suggestion-focus-flash'
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5 shrink-0">
            {KIND_LABEL[suggestion.kind] ?? suggestion.kind}
          </span>
          <span className="min-w-0 break-words">{suggestion.titel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 min-w-0">
        {suggestion.begruendung && (
          <p className="text-sm text-muted-foreground">{displayBegruendung(suggestion)}</p>
        )}
        {seasonHint && <p className="text-xs text-muted-foreground">{seasonHint}</p>}

        {suggestion.kind === 'xor_candidate' && xorNames.length >= 2 && (
          <p className="text-sm">
            Entweder <strong>{xorNames[0]}</strong> oder <strong>{xorNames[1]}</strong>
            {xorNames[1]?.includes(' und ') ? ' (zusammen).' : '.'}
          </p>
        )}

        {vacationName && (
          <div className="rounded-lg border border-[rgb(45,79,30)]/20 bg-[rgb(237,242,233)] dark:bg-[rgb(38,48,34)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Packliste</p>
            <p className="text-sm font-medium text-brand-heading">{vacationName}</p>
          </div>
        )}

        {suggestion.kind === 'platzplan' && (
          <div className="space-y-2 min-w-0">
            {choices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine URL zum Prüfen.</p>
            ) : (
              <div role="radiogroup" aria-label="Platzplan wählen" className="space-y-2 min-w-0">
                <p className="text-xs font-medium text-brand-heading">URL prüfen und wählen</p>
                {choices.map((c) => {
                  const selected = chosenUrl === c.url
                  return (
                    <div
                      key={c.url}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => setChosenUrl(c.url)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setChosenUrl(c.url)
                        }
                      }}
                      className={cn(
                        'relative flex items-start gap-2 sm:gap-3 rounded-[10px] border px-3 py-2.5 cursor-pointer select-none transition-colors min-w-0 max-w-full',
                        selected
                          ? 'border-[rgb(45,79,30)]/40 bg-[rgb(237,242,233)] dark:bg-[rgb(38,48,34)]'
                          : 'border-subtle dark:border-white/10 bg-card hover:shadow-md'
                      )}
                    >
                      {selected && (
                        <span
                          className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[10px] bg-[rgb(45,79,30)]"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                          selected
                            ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white'
                            : 'border-[rgb(45,79,30)]/45 bg-card'
                        )}
                        aria-hidden
                      >
                        {selected ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[rgb(45,79,30)]/30" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="min-w-0 flex-1 text-sm font-medium text-brand-heading break-all">
                            {c.label}
                          </span>
                          {c.isRecommended && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-muted-foreground">
                              Vorschlag
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.url}</p>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Im neuen Tab öffnen"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-brand-heading pt-0.5"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Link öffnen</span>
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          {acceptConsequence(suggestion)}
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            disabled={busy || (suggestion.kind === 'platzplan' && !chosenUrl)}
            onClick={() =>
              void onAct(
                'accept',
                suggestion.kind === 'platzplan' ? { url: chosenUrl } : undefined
              )
            }
          >
            {acceptButtonLabel(suggestion)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            title="Blendet den Vorschlag für 7 Tage aus, danach erscheint er wieder."
            onClick={() => void onAct('snooze')}
          >
            Später
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onAct('dismiss')}
          >
            Verwerfen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
