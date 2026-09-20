'use client'

import { useEffect } from 'react'

/**
 * Nach einem Deploy ändern sich die Content-Hashes der Next.js-Chunks.
 * Offene Tabs (oder ein noch aktiver alter Service Worker) referenzieren dann
 * gelöschte Dateien → ChunkLoadError. Ein einmaliger Reload holt die neue Version.
 */
const RELOAD_KEY = 'chunk-load-recovery'

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    const name = error.name || ''
    const message = error.message || ''
    return (
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('error loading dynamically imported module')
    )
  }
  if (typeof error === 'string') {
    return (
      error.includes('Loading chunk') ||
      error.includes('ChunkLoadError') ||
      error.includes('dynamically imported module')
    )
  }
  return false
}

async function clearStaleDocumentCaches(): Promise<void> {
  if (!('caches' in window)) return
  try {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter(
          (name) =>
            name.includes('app-html') ||
            name.includes('app-rsc') ||
            name.includes('pages-rsc') ||
            name.startsWith('serwist-precache')
        )
        .map((name) => caches.delete(name))
    )
  } catch {
    /* ignore – Reload trotzdem ausführen */
  }
}

async function activateWaitingServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      // Kurz warten, damit der neue SW Claim übernehmen kann
      await new Promise((r) => setTimeout(r, 300))
    }
  } catch {
    /* ignore */
  }
}

async function recoverFromStaleBuild(): Promise<void> {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(RELOAD_KEY)) return

  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  await activateWaitingServiceWorker()
  await clearStaleDocumentCaches()
  window.location.reload()
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    // Erfolgreicher Start nach Reload: Marker zurücksetzen, damit künftige
    // Deploys wieder eine Recovery bekommen.
    sessionStorage.removeItem(RELOAD_KEY)

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault()
        void recoverFromStaleBuild()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault()
        void recoverFromStaleBuild()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
