/**
 * Helper für Packlisten-Echtzeit-Sync via Durable Object.
 * Wird von den Packlisten-APIs aufgerufen, um verbundene WebSocket-Clients
 * zu benachrichtigen, dass sie die Packliste neu laden sollen.
 */

export interface PackingSyncEnv {
  PACKING_SYNC_DO?: DurableObjectNamespace
}

/**
 * Benachrichtigt das Durable Object, dass die Packliste für den angegebenen
 * Urlaub geändert wurde. Alle verbundenen WebSocket-Clients erhalten ein
 * packing-list-changed Event und können die Packliste neu laden.
 */
export async function notifyPackingSyncChange(
  env: PackingSyncEnv,
  vacationId: string
): Promise<void> {
  const namespace = env.PACKING_SYNC_DO
  if (!namespace) return

  try {
    const id = namespace.idFromName(vacationId)
    const stub = namespace.get(id)
    await stub.fetch(
      new Request('https://internal/internal/broadcast', { method: 'POST' })
    )
  } catch (err) {
    console.warn('PackingSync DO notify failed:', err)
  }
}
