/**
 * Serielle Ausführung von Packlisten-Mutationen pro Eintrag (bzw. Eintrag+Person/Gruppe).
 * Verhindert, dass bei langsamer Verbindung ein spät ankommendes Abhaken-PUT ein
 * bereits gesendetes Rückgängig-PUT auf dem Server überschreibt.
 */

const chains = new Map<string, Promise<unknown>>()

export function packingItemMutationKey(itemId: string): string {
  return `packing-item:${itemId}`
}

export function packingMitreisenderMutationKey(
  itemId: string,
  mitreisenderId: string
): string {
  return `packing-mitreisender:${itemId}:${mitreisenderId}`
}

export function packingGruppeMutationKey(itemId: string, gruppeId: string): string {
  return `packing-gruppe:${itemId}:${gruppeId}`
}

/**
 * Führt `fn` erst aus, wenn alle vorherigen Mutationen mit demselben `key` abgeschlossen sind.
 * Fehler in der Kette blockieren nachfolgende Aufrufe nicht.
 */
export function enqueuePackingMutation<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  chains.set(key, next)
  return next.finally(() => {
    if (chains.get(key) === next) {
      chains.delete(key)
    }
  })
}
