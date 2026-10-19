/**
 * Helper für Packlisten-Echtzeit-Sync via Durable Object.
 * Wird von den Packlisten-APIs aufgerufen, um verbundene WebSocket-Clients
 * zu benachrichtigen. Bei einfachen Gepackt-Toggles kann ein Delta-Patch
 * mitgeschickt werden – Clients aktualisieren lokal ohne Full-Reload (D1).
 *
 * Zusätzlich: Debounce für Integrations-Webhooks (gebündelte packedDelta-Updates).
 */

export interface PackingSyncEnv {
  PACKING_SYNC_DO?: DurableObjectNamespace
}

/** Einzelne Gepackt-Änderung für Client-seitiges Merge ohne Full-Fetch. */
export type PackingSyncPatchOp =
  | {
      op: 'item-gepackt'
      id: string
      gepackt: boolean
      gepackt_vorgemerkt?: boolean
      gepackt_vorgemerkt_durch?: string | null
    }
  | {
      op: 'mitreisender-gepackt'
      id: string
      mitreisenderId: string
      gepackt: boolean
      gepackt_vorgemerkt?: boolean
      mitreisenderName?: string
    }
  | {
      op: 'gruppe-gepackt'
      id: string
      gruppeId: string
      gepackt: boolean
      gepackt_vorgemerkt?: boolean
      gepackt_vorgemerkt_durch?: string | null
    }

export type PackingSyncMessage =
  | { type: 'packing-list-changed' }
  | { type: 'packing-patch'; patches: PackingSyncPatchOp[] }

/**
 * Benachrichtigt verbundene Clients. Ohne `message` bzw. mit
 * `packing-list-changed`: Full-Reload. Mit `packing-patch`: lokales Merge.
 */
export async function notifyPackingSyncChange(
  env: PackingSyncEnv,
  vacationId: string,
  message?: PackingSyncMessage
): Promise<void> {
  const namespace = env.PACKING_SYNC_DO
  if (!namespace) return

  const payload: PackingSyncMessage = message ?? { type: 'packing-list-changed' }

  try {
    const id = namespace.idFromName(vacationId)
    const stub = namespace.get(id)
    await stub.fetch(
      new Request('https://internal/internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
  } catch (err) {
    console.warn('PackingSync DO notify failed:', err)
  }
}

/**
 * Bündelt packedDelta für Webhooks (Trailing-Debounce im DO).
 * @returns true wenn geplant, false wenn kein DO (Caller soll sofort verarbeiten)
 */
export async function scheduleIntegrationDebounce(
  env: PackingSyncEnv,
  vacationId: string,
  packedDelta: number
): Promise<boolean> {
  const namespace = env.PACKING_SYNC_DO
  if (!namespace || packedDelta === 0) return false

  try {
    const id = namespace.idFromName(vacationId)
    const stub = namespace.get(id)
    const res = await stub.fetch(
      new Request('https://internal/internal/schedule-integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacationId, packedDelta }),
      })
    )
    return res.ok
  } catch (err) {
    console.warn('PackingSync DO schedule-integration failed:', err)
    return false
  }
}

/** Verwirft ausstehende Debounce-Deltas (z. B. vor sofortigem Full-Recount). */
export async function clearIntegrationDebounce(
  env: PackingSyncEnv,
  vacationId: string
): Promise<void> {
  const namespace = env.PACKING_SYNC_DO
  if (!namespace) return

  try {
    const id = namespace.idFromName(vacationId)
    const stub = namespace.get(id)
    await stub.fetch(
      new Request('https://internal/internal/clear-integration', { method: 'POST' })
    )
  } catch (err) {
    console.warn('PackingSync DO clear-integration failed:', err)
  }
}
