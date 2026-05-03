/**
 * Hilfsfunktionen für einheitliche Offline-Hinweise im UI.
 *
 * Die UI-Seite ruft `showOfflineToast()` aus einem Catch-Block, wenn ein Lese-Pfad auf den
 * Cache zurückgefallen ist, oder einen Mutations-Fehler offline behandelt.
 */

import { toast } from '@/hooks/use-toast'

/**
 * Standard-Hinweis: "Offline – Anzeige aus dem Cache".
 */
export function showOfflineToast(opts?: {
  description?: string
  title?: string
}): void {
  toast({
    title: opts?.title ?? 'Offline-Modus',
    description: opts?.description ?? 'Daten werden aus dem lokalen Cache angezeigt.',
  })
}

/**
 * Hinweis nach Offline-Mutation: "Wird bei Wiederverbindung gesendet".
 */
export function showQueuedToast(opts?: {
  description?: string
  title?: string
}): void {
  toast({
    title: opts?.title ?? 'Offline gespeichert',
    description:
      opts?.description ??
      'Die Änderung wird automatisch synchronisiert, sobald die Verbindung wieder steht.',
  })
}

/**
 * Hinweis nach erfolgreichem Reconnect-Sync.
 */
export function showSyncedToast(count: number): void {
  if (count <= 0) return
  toast({
    title: 'Synchronisiert',
    description: `${count} Änderung${count === 1 ? '' : 'en'} erfolgreich gesendet.`,
  })
}

/**
 * Generischer "etwas ging offline schief"-Toast – Variante mit Fehlermeldung.
 */
export function showOfflineErrorToast(message?: string): void {
  toast({
    title: 'Offline – Daten unvollständig',
    description:
      message ??
      'Es ist offline kein zwischengespeicherter Wert verfügbar. Bitte erneut versuchen, sobald Internet vorhanden ist.',
    variant: 'destructive',
  })
}

/**
 * Prüft, ob der Browser sicher offline ist (best effort).
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}
