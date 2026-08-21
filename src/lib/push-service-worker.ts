/** Leichtgewichtiger SW für Push-Tests in `pnpm dev` (ohne Serwist-Precache). */
const DEV_PUSH_SW_PATH = '/push-sw.js'

/** Produktions-PWA (Serwist). */
const PROD_SW = '/sw.js'

function isPushDevWorker(scriptUrl: string | undefined): boolean {
  return !!scriptUrl && scriptUrl.includes('push-sw')
}

/**
 * Stellt einen Service Worker für Push bereit.
 * In der Entwicklung: push-sw.js (wie Rastplatz-Push). In Produktion: Serwist /sw.js.
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  const isDev = process.env.NODE_ENV === 'development'
  // Cache-Bust, damit Dev-Änderungen an push-sw.js zuverlässig greifen
  const targetScript = isDev
    ? `${DEV_PUSH_SW_PATH}?v=push-nav-soft-1`
    : PROD_SW

  try {
    if (isDev) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    } else {
      const regExisting = await navigator.serviceWorker.getRegistration('/')
      const activeScript =
        regExisting?.active?.scriptURL ?? regExisting?.waiting?.scriptURL ?? ''
      if (regExisting && activeScript.includes('/sw.js')) {
        await navigator.serviceWorker.ready
        return regExisting
      }
    }

    const reg = await navigator.serviceWorker.register(targetScript, {
      scope: '/',
      updateViaCache: 'none',
    })
    await reg.update()
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.warn('Push Service Worker registration failed:', err)
    return null
  }
}
