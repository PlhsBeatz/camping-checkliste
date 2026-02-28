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

    // Versuche, den Shortlink aufzulösen, um die finale Google-Maps-URL zu erhalten.
    let resolvedUrl = rawUrl
    try {
      const res = await fetch(rawUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
        },
      })
      if (res.url) {
        resolvedUrl = res.url
      }
    } catch {
      resolvedUrl = rawUrl
    }

    // Place-ID aus der URL extrahieren (z.B. aus data=!3m1!4b1!4m5!3m4!1sChIJ... oder !1s0x... im Pfad oder Fragment)
    function extractPlaceIdFromMapsUrl(url: string): string | null {
      // Gesamte URL inkl. Hash durchsuchen (Place-ID steht oft im Fragment)
      const match = url.match(/!1s([^!]+)/)
      return match ? decodeURIComponent(match[1]) : null
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

    // 2) Fallback: Suchbegriff aus URL extrahieren und searchText aufrufen
    if (!place) {
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

    if (!place) {
      return NextResponse.json(
        { success: false, error: 'Kein passender Ort für diesen Link gefunden.' },
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

