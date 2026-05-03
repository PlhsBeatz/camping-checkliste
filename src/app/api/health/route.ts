import { NextResponse } from 'next/server'

/**
 * Leichtgewichtiger Health-Endpoint.
 *
 * Wird vom `useNetworkStatus`-Hook periodisch aufgerufen, um echte Konnektivität zu prüfen
 * (`navigator.onLine` lügt bei Captive Portals und schlechter Mobilfunk-Verbindung).
 *
 * Wichtig: KEIN Service-Worker-Caching für diesen Endpoint, daher `Cache-Control: no-store`.
 * Damit ist sichergestellt, dass eine erfolgreiche Antwort wirklich vom Server stammt und
 * nicht aus dem SW-Cache.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    }
  )
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}
