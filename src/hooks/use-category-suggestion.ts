'use client'

import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import type { CategorySuggestMatch } from '@/lib/category-suggest-types'

export function useCategorySuggestion(name: string, enabled: boolean) {
  const [suggestion, setSuggestion] = useState<CategorySuggestMatch | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setSuggestion(null)
      return
    }

    const handle = window.setTimeout(() => {
      setLoading(true)
      void fetch('/api/suggestions/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
        .then((r) => r.json() as Promise<ApiResponse<CategorySuggestMatch | null>>)
        .then((json: ApiResponse<CategorySuggestMatch | null>) => {
          if (json.success) setSuggestion(json.data ?? null)
        })
        .catch(() => setSuggestion(null))
        .finally(() => setLoading(false))
    }, 650)

    return () => window.clearTimeout(handle)
  }, [name, enabled])

  return { suggestion, loading }
}
