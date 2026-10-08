/**
 * Cloudflare `caches.default` – im DOM-CacheStorage-Typ nicht enthalten.
 */
export function getEdgeCache(): Cache | null {
  try {
    const c = (caches as unknown as { default?: Cache }).default
    return c ?? null
  } catch {
    return null
  }
}
