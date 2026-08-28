'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  SUGGESTION_FOCUS_FLASH_MS,
  readSuggestionFocusId,
  suggestionDomId,
} from '@/lib/smart-suggestion-focus'

export function useSuggestionFocusId(): string | null {
  const searchParams = useSearchParams()
  const fromParams = readSuggestionFocusId(searchParams)
  const [fromWindow, setFromWindow] = useState<string | null>(null)

  useEffect(() => {
    setFromWindow(readSuggestionFocusId(new URLSearchParams(window.location.search)))
  }, [searchParams, fromParams])

  return fromParams ?? fromWindow
}

export function useSuggestionFocusFlash(focusId: string | null): boolean {
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (!focusId) {
      setFlashing(false)
      return
    }

    let cancelled = false
    let retryTimer = 0
    let endTimer = 0
    let relayoutTimer = 0
    const deadline = Date.now() + 10000

    const scrollToCard = () => {
      document
        .getElementById(suggestionDomId(focusId))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const tryScroll = () => {
      if (cancelled) return
      const el = document.getElementById(suggestionDomId(focusId))
      if (!el && Date.now() < deadline) {
        retryTimer = window.setTimeout(tryScroll, 120)
        return
      }
      if (!el) return
      scrollToCard()
      setFlashing(true)
      relayoutTimer = window.setTimeout(scrollToCard, 400)
      endTimer = window.setTimeout(() => {
        if (cancelled) return
        setFlashing(false)
      }, SUGGESTION_FOCUS_FLASH_MS)
    }

    retryTimer = window.setTimeout(tryScroll, 50)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      window.clearTimeout(relayoutTimer)
      window.clearTimeout(endTimer)
    }
  }, [focusId])

  return flashing
}
