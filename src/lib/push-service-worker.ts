/** Leichtgewichtiger SW für Push-Tests in `pnpm dev` (ohne Serwist-Precache). */
const DEV_PUSH_SW = '/push-sw.js'

/** Produktions-PWA (Serwist). */
const PROD_SW = '/sw.js'

function isPushDevWorker(scriptUrl: string | undefined): boolean {
  return !!scriptUrl && scriptUrl.includes('push-sw')
}

/**
 * Stellt einen Service Worker für Push bereit.
 * In der Entwicklung: push-sw.js. In Produktion: Serwist /sw.js (falls vorhanden).
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  const isDev = process.env.NODE_ENV === 'development'
  const targetScript = isDev ? DEV_PUSH_SW : PROD_SW

  let reg = await navigator.serviceWorker.getRegistration('/')
  const activeScript = reg?.active?.scriptURL ?? reg?.waiting?.scriptURL ?? ''

  const hasCorrectWorker = isDev
    ? isPushDevWorker(activeScript)
    : activeScript.includes('/sw.js')

  if (!reg || !hasCorrectWorker) {
    if (isDev) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs
          .filter((r) => !isPushDevWorker(r.active?.scriptURL ?? r.installing?.scriptURL))
          .map((r) => r.unregister())
      )
    }
    try {
      reg = await navigator.serviceWorker.register(targetScript, { scope: '/' })
    } catch (err) {
      console.warn('Push Service Worker registration failed:', err)
      return null
    }
  }

  await navigator.serviceWorker.ready
  return reg
}
