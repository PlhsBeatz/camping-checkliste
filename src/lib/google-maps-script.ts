const SCRIPT_ID = 'google-maps-places-script'

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

/** Lädt das Maps-JS-SDK zuverlässig (auch wenn das Script-Tag schon existiert). */
export function loadGoogleMapsScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (hasImportLibrary()) return Promise.resolve(true)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return Promise.resolve(false)

  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve) => {
    const finish = () => resolve(hasImportLibrary())

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (hasImportLibrary()) {
        finish()
        return
      }
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })

      const started = Date.now()
      const poll = window.setInterval(() => {
        if (hasImportLibrary()) {
          window.clearInterval(poll)
          finish()
        } else if (Date.now() - started > 15_000) {
          window.clearInterval(poll)
          resolve(false)
        }
      }, 50)
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&loading=async&libraries=places&language=de&region=DE&v=weekly'
    script.onload = finish
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
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
