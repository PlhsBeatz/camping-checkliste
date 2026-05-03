/**
 * Last-Write-Wins (LWW) Helfer für Offline-Mutationen.
 *
 * Strategie:
 * 1. Mutationen, die offline angestoßen werden, schreiben optional einen
 *    `client_updated_at` (ISO-String) ins Payload.
 * 2. Server-Endpoints, die LWW unterstützen, vergleichen `client_updated_at` mit dem
 *    aktuellen Server-`updated_at`. Ist die Server-Version *neuer*, wird die Mutation
 *    nicht angewendet und der aktuelle Server-Stand mit `staleConflict: true` zurückgegeben,
 *    sodass der Client merge'n kann.
 * 3. Liefert der Client kein `client_updated_at`, gilt der bisherige Pfad
 *    (immer akzeptieren) – damit Bestandscode unverändert weiterläuft.
 */

export interface LWWPayload {
  /** ISO-String, wann der Client die Änderung lokal commited hat. */
  client_updated_at?: string
}

/**
 * Liefert ein Payload-Objekt mit `client_updated_at`, das der `useOptimisticMutation`-Hook
 * direkt durchreichen kann.
 */
export function withClientTimestamp<T extends object>(payload: T): T & LWWPayload {
  return { ...payload, client_updated_at: new Date().toISOString() }
}

/**
 * Prüft, ob ein Server-Datensatz im Sinne von LWW *neuer* ist als die Client-Mutation.
 *
 * @returns `true`, wenn die Server-Version neuer ist und die Mutation übersprungen werden
 *   sollte. Bei fehlenden/ungültigen Timestamps: `false` (kein Konflikt erkennbar →
 *   Mutation anwenden).
 */
export function isStaleClientWrite(
  clientUpdatedAt: string | undefined | null,
  serverUpdatedAt: string | undefined | null
): boolean {
  if (!clientUpdatedAt || !serverUpdatedAt) return false
  const c = Date.parse(clientUpdatedAt)
  const s = Date.parse(serverUpdatedAt)
  if (Number.isNaN(c) || Number.isNaN(s)) return false
  return s > c
}
