'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ensurePushServiceWorker } from '@/lib/push-service-worker'
import { describeVapidSetupError } from '@/lib/push-vapid-errors'

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function saveSubscriptionToServer(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })
  const data = (await res.json()) as { success?: boolean; error?: string }
  if (!data.success) {
    console.warn('Push subscription save failed:', data.error)
    return false
  }
  return true
}

export function usePushSubscribe() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const pendingSubscribeRef = useRef(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    setSupported(ok)
    if (!ok) return

    void (async () => {
      try {
        const r = await fetch('/api/push/subscribe', { credentials: 'include' })
        const j = (await r.json()) as {
          success?: boolean
          data?: {
            publicKey?: string | null
            enabled?: boolean
            privateKeyConfigured?: boolean
            privateKeyParseFailed?: boolean
            keyPairMatch?: boolean
            setupHint?: string | null
            diagnostics?: import('@/lib/push-vapid-errors').VapidDiagnostics
          }
        }
        if (j.success && j.data?.publicKey) {
          setPublicKey(j.data.publicKey)
        } else if (j.success && j.data) {
          setLastError(
            j.data.setupHint ??
              describeVapidSetupError({ ...j.data, diagnostics: j.data.diagnostics })
          )
        }
      } catch {
        setLastError('Push-Konfiguration konnte nicht geladen werden.')
      }
    })()
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLastError(null)
    if (!supported) {
      setLastError('Push wird von diesem Browser nicht unterstützt.')
      return false
    }
    if (!publicKey) {
      pendingSubscribeRef.current = true
      setLastError('VAPID-Schlüssel noch nicht geladen – bitte kurz warten und erneut versuchen.')
      return false
    }

    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setLastError('Benachrichtigungen wurden nicht erlaubt.')
        return false
      }

      const reg = await ensurePushServiceWorker()
      if (!reg) {
        setLastError('Service Worker für Push konnte nicht registriert werden.')
        return false
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const ok = await saveSubscriptionToServer(sub)
      if (ok) {
        setSubscribed(true)
        pendingSubscribeRef.current = false
        return true
      }
      setLastError('Push-Abo konnte nicht in der Datenbank gespeichert werden.')
    } catch (e) {
      console.warn('Push subscribe failed:', e)
      setLastError(
        e instanceof Error ? e.message : 'Push-Abo fehlgeschlagen (Konsole prüfen).'
      )
    }
    return false
  }, [supported, publicKey])

  useEffect(() => {
    if (!supported || !publicKey) return

    void (async () => {
      const reg = await ensurePushServiceWorker()
      if (!reg) return
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        const ok = await saveSubscriptionToServer(existing)
        if (ok) setSubscribed(true)
      }
    })()
  }, [supported, publicKey])

  useEffect(() => {
    if (publicKey && pendingSubscribeRef.current) {
      pendingSubscribeRef.current = false
      void subscribe()
    }
  }, [publicKey, subscribe])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setLastError(null)
    } catch {
      /* ignore */
    }
  }, [])

  return { supported, subscribed, publicKey, lastError, subscribe, unsubscribe }
}
