import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import type { RastplatzKategorie } from '@/lib/db'
import {
  RASTPLATZ_NEARBY_INCLUDED_TYPES,
  inferRastplatzKategorieFromGoogleTypes,
} from '@/lib/rastplatz-place-types'

type PlaceAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type NearbyPlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: PlaceAddressComponent[]
  types?: string[]
  primaryType?: string
}

type SearchNearbyResponse = {
  places?: NearbyPlace[]
}

export type NearbyPlaceResult = {
  placeId: string | null
  name: string
  address: string
  lat: number
  lng: number
  ort: string | null
  bundesland: string | null
  land: string | null
  kategorie: RastplatzKategorie
}

const NEARBY_TYPES = RASTPLATZ_NEARBY_INCLUDED_TYPES

const RATE_LIMIT_MS = 30_000
const lastCallByUser = new Map<string, number>()

function pickComponent(comps: PlaceAddressComponent[] | undefined, type: string): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes(type)) {
      const v = c.longText ?? c.shortText
      if (v?.trim()) return v.trim()
    }
  }
  return null
}

function deriveOrt(comps: PlaceAddressComponent[] | undefined): string | null {
  return (
    pickComponent(comps, 'locality') ??
    pickComponent(comps, 'postal_town') ??
    pickComponent(comps, 'administrative_area_level_3') ??
    pickComponent(comps, 'sublocality')
  )
}

function mapGoogleTypeToKategorie(types: string[] | undefined, primary?: string): RastplatzKategorie {
  return inferRastplatzKategorieFromGoogleTypes(types, primary)
}

function mapPlace(p: NearbyPlace): NearbyPlaceResult | null {
  const lat = p.location?.latitude
  const lng = p.location?.longitude
  if (lat == null || lng == null) return null
  const name = p.displayName?.text?.trim() || 'Unbekannter Ort'
  return {
    placeId: p.id?.replace(/^places\//, '') ?? p.id ?? null,
    name,
    address: p.formattedAddress?.trim() || name,
    lat,
    lng,
    ort: deriveOrt(p.addressComponents),
    bundesland: pickComponent(p.addressComponents, 'administrative_area_level_1'),
    land: pickComponent(p.addressComponents, 'country'),
    kategorie: mapGoogleTypeToKategorie(p.types, p.primaryType),
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as { lat?: number; lng?: number; radius?: number }
    if (body.lat == null || body.lng == null) {
      return NextResponse.json(
        { success: false, error: 'lat und lng sind erforderlich' },
        { status: 400 }
      )
    }

    const userId = auth.userContext.userId
    const now = Date.now()
    const last = lastCallByUser.get(userId) ?? 0
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: 'Bitte kurz warten (Rate-Limit).' },
        { status: 429 }
      )
    }
    lastCallByUser.set(userId, now)

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_MAPS_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const radius = Math.min(Math.max(body.radius ?? 150, 50), 500)

    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types,places.primaryType',
      },
      body: JSON.stringify({
        maxResultCount: 5,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: { latitude: body.lat, longitude: body.lng },
            radius,
          },
        },
        includedTypes: NEARBY_TYPES,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { success: false, error: `Places API: ${res.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const json = (await res.json()) as SearchNearbyResponse
    const places = (json.places ?? [])
      .map(mapPlace)
      .filter((p): p is NearbyPlaceResult => p != null)

    return NextResponse.json({ success: true, data: places })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
