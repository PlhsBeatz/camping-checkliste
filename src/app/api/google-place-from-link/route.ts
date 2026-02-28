import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

type PlaceAddressComponentServer = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlaceServer = {
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: PlaceAddressComponentServer[]
  photos?: Array<{ name?: string }>
  websiteUri?: string
}

type PlacesSearchTextResponse = {
  places?: PlaceServer[]
}

type CampingplatzAddressResolve = {
  address: string
  lat: number | null
  lng: number | null
  ort: string | null
  bundesland: string | null
  land: string | null
  placeName?: string
  website?: string | null
}

type PlacePhotoForPicker = { name: string }

function pickComponent(comps: PlaceAddressComponentServer[] | undefined, type: string): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes(type)) {
      const v = c.longText ?? c.shortText
      if (v && String(v).trim()) return String(v).trim()
    }
  }
  return null
}

function deriveOrt(comps: PlaceAddressComponentServer[] | undefined): string | null {
  return (
    pickComponent(comps, 'locality') ??
    pickComponent(comps, 'postal_town') ??
    pickComponent(comps, 'administrative_area_level_3') ??
    pickComponent(comps, 'administrative_area_level_2') ??
    pickComponent(comps, 'sublocality') ??
    pickComponent(comps, 'sublocality_level_1')
  )
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as { url?: string }
    const rawUrl = body.url?.trim()
    if (!rawUrl) {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_MAPS_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Versuche, den Shortlink aufzulösen (Redirects folgen oder aus HTML auslesen).
    const browserHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    }
    let resolvedUrl = rawUrl
    try {
      const res = await fetch(rawUrl, {
        redirect: 'follow',
        headers: browserHeaders,
      })
      if (res.url && res.url !== rawUrl) {
        resolvedUrl = res.url
      }
      // Wenn wir noch auf dem Shortlink sind: Redirect manuell aus Location-Header-Kette holen
      if (
        resolvedUrl.startsWith('https://maps.app.goo.gl/') ||
        resolvedUrl.startsWith('https://goo.gl/maps/')
      ) {
        let current = rawUrl
        for (let i = 0; i < 5; i++) {
          const r = await fetch(current, {
            redirect: 'manual',
            headers: browserHeaders,
          })
          const loc = r.headers.get('location')
          if (loc) {
            current = loc.startsWith('http') ? loc : new URL(loc, current).toString()
            resolvedUrl = current
            if (!current.includes('goo.gl') && !current.includes('maps.app.goo.gl')) {
              break
            }
          } else {
            break
          }
        }
      }
      // Fallback: Aus HTML nach finaler URL suchen (meta refresh, canonical, og:url, beliebige google.com/maps-URL)
      if (
        resolvedUrl.startsWith('https://maps.app.goo.gl/') ||
        resolvedUrl.startsWith('https://goo.gl/')
      ) {
        const htmlRes = await fetch(resolvedUrl, {
          redirect: 'follow',
          headers: browserHeaders,
        })
        const html = await htmlRes.text()
        // Nach dem Abruf: Wenn der Server trotzdem weitergeleitet hat, diese URL nutzen
        if (htmlRes.url && !htmlRes.url.includes('goo.gl')) {
          resolvedUrl = htmlRes.url
        } else {
          const metaRefresh = html.match(/content="\d+;?\s*url=([^"]+)"/i)
            ?? html.match(/content='\d+;?\s*url=([^']+)'/i)
            ?? html.match(/content="\d+;?\s*URL=([^"]+)"/i)
            ?? html.match(/content=\s*["']?\d+[^"']*url\s*=\s*([^\s"'>]+)/i)
          if (metaRefresh?.[1]) {
            resolvedUrl = metaRefresh[1].replace(/&amp;/g, '&').trim()
          }
          if (resolvedUrl.includes('goo.gl')) {
            const jsRedirect =
              html.match(/window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i)
              ?? html.match(/location\.href\s*=\s*["']([^"']+)["']/i)
              ?? html.match(/window\.location\s*=\s*["']([^"']+)["']/i)
              ?? html.match(/redirect\s*=\s*["']([^"']+)["']/i)
            if (jsRedirect?.[1]) {
              resolvedUrl = jsRedirect[1].replace(/&amp;/g, '&').trim()
            }
          }
          if (resolvedUrl.includes('goo.gl')) {
            const canonical =
              html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ??
              html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)
            if (canonical?.[1]) {
              resolvedUrl = canonical[1].replace(/&amp;/g, '&').trim()
            }
          }
          if (resolvedUrl.includes('goo.gl')) {
            const ogUrl =
              html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i) ??
              html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i)
            if (ogUrl?.[1]) {
              resolvedUrl = ogUrl[1].replace(/&amp;/g, '&').trim()
            }
          }
          // Letzter Fallback: erste google.com/maps- oder google.de/maps-URL im HTML
          if (resolvedUrl.includes('goo.gl')) {
            const anyMapsUrl = html.match(
              /https:\/\/(?:www\.)?google\.(?:de|com)\/maps\/[^\s"'<>]+/
            )
            if (anyMapsUrl?.[0]) {
              resolvedUrl = anyMapsUrl[0].replace(/&amp;/g, '&').replace(/["']+$/, '').trim()
            }
          }
        }
      }
      // Ein zweiter Versuch mit anderem User-Agent, wenn wir immer noch den Kurzlink haben
      if (
        (resolvedUrl.startsWith('https://maps.app.goo.gl/') ||
          resolvedUrl.startsWith('https://goo.gl/')) &&
        resolvedUrl === rawUrl
      ) {
        const altHeaders = {
          ...browserHeaders,
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
        const res2 = await fetch(rawUrl, { redirect: 'follow', headers: altHeaders })
        if (res2.url && !res2.url.includes('goo.gl')) {
          resolvedUrl = res2.url
        }
      }
    } catch {
      resolvedUrl = rawUrl
    }

    // Place-ID aus der URL extrahieren (z.B. aus data=!3m1!4b1!4m5!3m4!1sChIJ... oder !1s0x... im Pfad oder Fragment)
    function extractPlaceIdFromMapsUrl(url: string): string | null {
      // Gesamte URL inkl. Hash durchsuchen (Place-ID steht oft im Fragment)
      const match = url.match(/!1s([^!]+)/)
      const id = match?.[1]
      return id ? decodeURIComponent(id) : null
    }

    const fieldMaskList = [
      'displayName',
      'formattedAddress',
      'location',
      'addressComponents',
      'photos',
      'websiteUri',
    ]
    const placeDetailsFieldMask = fieldMaskList.join(',')
    const searchTextFieldMask = fieldMaskList.map((f) => `places.${f}`).join(',')

    let place: PlaceServer | null = null
    const placeId = extractPlaceIdFromMapsUrl(resolvedUrl)

    // 1) Wenn wir eine Place-ID haben: Place Details API (exakt derselbe Eintrag wie hinter dem Link)
    if (placeId) {
      const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
      const detailsRes = await fetch(detailsUrl, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': placeDetailsFieldMask,
        },
      })
      if (detailsRes.ok) {
        const detailsJson = (await detailsRes.json()) as PlaceServer
        place = detailsJson
      }
    }

    // 2) Fallback nur, wenn wir eine aufgelöste Long-URL haben: Suchbegriff aus URL extrahieren, searchText
    // Bei Kurzlink ohne Auflösung kein searchText (kein „erster Treffer“) – URL-Eingabe ist reiner Fallback.
    if (!place) {
      const isStillShortLink =
        resolvedUrl.startsWith('https://maps.app.goo.gl/') ||
        resolvedUrl.startsWith('https://goo.gl/')
      if (!isStillShortLink) {
        let textQuery = resolvedUrl
        try {
          const u = new URL(resolvedUrl)
          const pathnameParts = u.pathname.split('/').filter(Boolean)
          const placeIndex = pathnameParts.indexOf('place')
          let nameFromPath: string | null = null
          if (placeIndex >= 0 && pathnameParts[placeIndex + 1]) {
            const rawPart = pathnameParts[placeIndex + 1] ?? ''
            const decoded = decodeURIComponent(rawPart.replace(/\+/g, ' '))
            if (decoded && decoded !== '@' && !decoded.startsWith('@')) {
              nameFromPath = decoded
            }
          }
          const qParam =
            u.searchParams.get('q') ??
            u.searchParams.get('query') ??
            u.searchParams.get('destination') ??
            null
          let nameFromQuery: string | null = null
          if (qParam) {
            const decoded = decodeURIComponent(qParam.replace(/\+/g, ' '))
            if (decoded && decoded !== '@') {
              nameFromQuery = decoded
            }
          }
          const extracted = nameFromPath ?? nameFromQuery
          if (extracted) {
            textQuery = extracted
          }
        } catch {
          textQuery = resolvedUrl
        }

        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': searchTextFieldMask,
          },
          body: JSON.stringify({
            textQuery,
            languageCode: 'de',
            pageSize: 1,
          }),
        })

        if (searchRes.ok) {
          const searchJson = (await searchRes.json()) as PlacesSearchTextResponse
          place = searchJson.places?.[0] ?? null
        }
      }
    }

    if (!place) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Kein passender Ort für diesen Link gefunden. Tipp: Link im Browser öffnen und die vollständige URL aus der Adresszeile hier einfügen.',
          debug: { resolvedUrl, extractedPlaceId: placeId ?? undefined },
        },
        { status: 404 }
      )
    }

    const addr = place.formattedAddress ?? resolvedUrl
    const lat = typeof place.location?.latitude === 'number' ? place.location.latitude : null
    const lng = typeof place.location?.longitude === 'number' ? place.location.longitude : null
    const land = pickComponent(place.addressComponents, 'country')
    const bundesland = pickComponent(place.addressComponents, 'administrative_area_level_1')
    const ort = deriveOrt(place.addressComponents)
    const placeName = place.displayName?.text ?? undefined
    const website = place.websiteUri ?? null

    const resolveResult: CampingplatzAddressResolve = {
      address: addr,
      lat,
      lng,
      ort,
      bundesland,
      land,
      placeName,
      website,
    }

    const photos = (place.photos ?? [])
      .slice(0, 10)
      .map((p) => ({ name: p.name ?? '' }))
      .filter((p): p is PlacePhotoForPicker => !!p.name)

    return NextResponse.json({
      success: true,
      data: {
        resolve: resolveResult,
        photos,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

