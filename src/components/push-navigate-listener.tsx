'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Empfängt PUSH_NAVIGATE vom Service Worker (Notification-Klick)
 * und navigiert clientseitig – zuverlässiger als WindowClient.navigate().
 */
export function PushNavigateListener() {
  const router = useRouter()

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (!data || data.type !== 'PUSH_NAVIGATE' || typeof data.url !== 'string') return

      try {
        const target = new URL(data.url, window.location.origin)
        if (target.origin !== window.location.origin) return
        const href = `${target.pathname}${target.search}${target.hash}`
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (href === current) return
        router.push(href)
      } catch {
        /* ignore */
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router])

  return null
}
