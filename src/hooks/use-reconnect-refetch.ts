'use client'

import { useEffect, useRef } from 'react'
import { subscribeToOnlineStatus } from '@/lib/offline-sync'

/**
 * Ruft `refetch` automatisch erneut auf, sobald der Browser von "offline" auf "online"
 * wechselt. Ignoriert das initiale `online=true`, das `subscribeToOnlineStatus` direkt
 * nach dem Mount feuert, damit es keinen doppelten Fetch zum initialen Laden gibt.
 *
 * Übergebenes `refetch` darf eine `useCallback`-stable-Funktion sein. Wir referenzieren
 * den letzten Wert via Ref, damit der Subscribe-Handler nicht jedesmal neu aufgesetzt
 * werden muss, wenn der `refetch`-Identitätswert sich ändert.
 */
export function useReconnectRefetch(refetch: () => void | Promise<void>): void {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    let initialCallback = true
    let lastOnline =
      typeof navigator !== 'undefined' ? navigator.onLine : true

    return subscribeToOnlineStatus((online) => {
      if (initialCallback) {
        initialCallback = false
        lastOnline = online
        return
      }
      // Nur bei echtem Wechsel offline → online refetchen
      if (online && !lastOnline) {
        try {
          void refetchRef.current()
        } catch (err) {
          console.warn('useReconnectRefetch: refetch warf eine Exception', err)
        }
      }
      lastOnline = online
    })
  }, [])
}
