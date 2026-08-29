const SCRIPT_ID = 'google-maps-places-script'
const READY_TIMEOUT_MS = 15_000
const RETRY_DELAYS_MS = [400, 1_200]

type GoogleMapsWindow = typeof window & {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>
    }
  }
}

function getGoogleMapsWindow(): GoogleMapsWindow {
  return window as GoogleMapsWindow
}

function hasImportLibrary(): boolean {
  return typeof getGoogleMapsWindow().google?.maps?.importLibrary === 'function'
}

let scriptLoadPromise: Promise<boolean> | null = null

function waitForImportLibrary(timeoutMs: number): Promise<boolean> {
  if (hasImportLibrary()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const started = Date.now()
    const poll = window.setInterval(() => {
      if (hasImportLibrary()) {
        window.clearInterval(poll)
        resolve(true)
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(poll)
        resolve(false)
      }
    }, 50)
  })
}

function loadScriptOnce(apiKey: string): Promise<boolean> {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return waitForImportLibrary(READY_TIMEOUT_MS)
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&loading=async&libraries=places&language=de&region=DE&v=weekly'
    script.onload = () => {
      void waitForImportLibrary(READY_TIMEOUT_MS).then(resolve)
    }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Lädt das Maps-JS-SDK zuverlässig (auch wenn das Script-Tag schon existiert). */
export function loadGoogleMapsScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (hasImportLibrary()) return Promise.resolve(true)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return Promise.resolve(false)

  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = (async () => {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await delay(RETRY_DELAYS_MS[attempt - 1] ?? 800)
        const stale = document.getElementById(SCRIPT_ID)
        if (stale && !hasImportLibrary()) stale.remove()
      }
      const ok = await loadScriptOnce(apiKey)
      if (ok || hasImportLibrary()) return true
    }
    return hasImportLibrary()
  })().then((ok) => {
    if (!ok) scriptLoadPromise = null
    return ok
  })

  return scriptLoadPromise
}

export async function importGoogleMapsLibrary<T>(name: string): Promise<T | null> {
  const loaded = await loadGoogleMapsScript()
  if (!loaded) return null
  try {
    const lib = await getGoogleMapsWindow().google!.maps!.importLibrary!(name)
    return lib as T
  } catch {
    return null
  }
}
