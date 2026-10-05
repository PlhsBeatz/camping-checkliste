'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as SunCalc from 'suncalc'
import { format } from 'date-fns'
import {
  DE_OSM_ATTRIBUTION,
  DE_OSM_TILE_URL,
  ESRI_WORLD_IMAGERY_ATTRIBUTION,
  ESRI_WORLD_IMAGERY_URL,
  OSM_MAX_ZOOM,
  SATELLITE_DEFAULT_ZOOM,
  SATELLITE_MAX_NATIVE_ZOOM,
  SATELLITE_MAX_ZOOM,
  SATELLITE_MIN_ZOOM,
  type SonnenBasemap,
} from '@/lib/satellite-tiles'
import { getCachedSatelliteTile } from '@/lib/satellite-tile-cache'
import {
  normalizeHeadingDeg,
  caravanOutlineToLatLngs,
  type MeterPoint,
} from '@/lib/caravan-geometry'
import { shortestAngleDiff } from '@/lib/device-compass-heading'
import { cn } from '@/lib/utils'

export type SonnenMapMode = 'vor-ort' | 'planung'

export type SonnenAusrichtungMapProps = {
  center: { lat: number; lng: number }
  mode: SonnenMapMode
  basemap: SonnenBasemap
  onSatelliteUnavailable?: (reason: string) => void
  onSatelliteAvailable?: () => void
  /** Vor Ort: Karte mit Geräteheading drehen (oben = Gerätevorne) */
  deviceHeading?: number | null
  date?: Date
  pin?: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
  caravan?: {
    outline: MeterPoint[]
    headingDeg: number
    center: { lat: number; lng: number }
    /** Rechteck-Maße für Grundriss-Bild (Aufbau × Breite) */
    lengthM?: number | null
    widthM?: number | null
    /** URL zum Grundriss-Bild; wenn gesetzt, kein Rechteck */
    imageUrl?: string | null
  } | null
  /** Wohnwagen per Drag verschiebbar */
  caravanDraggable?: boolean
  /** Karten-Pan sperren (z. B. Verschieben-Modus am Smartphone) */
  lockMapPan?: boolean
  onCaravanMove?: (lat: number, lng: number) => void
  className?: string
  /** CSS-Höhe, z. B. h-[420px] md:h-[580px] */
  heightClassName?: string
}

/** SunCalc-Azimut: 0 = Süd, positiv westwärts → Kompassgrad (0 = Nord). */
function suncalcAzimuthToCompass(azimuthRad: number): number {
  const deg = (azimuthRad * 180) / Math.PI
  return (((deg + 180) % 360) + 360) % 360
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Kompassgrad (0=N) → Lat/Lng-Offset in Metern */
function offsetByCompassMeters(
  lat: number,
  lng: number,
  compassDeg: number,
  meters: number
): [number, number] {
  const rad = ((90 - compassDeg) * Math.PI) / 180
  const dLat = (meters * Math.sin(rad)) / 111_320
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const dLng = (meters * Math.cos(rad)) / (111_320 * Math.max(Math.abs(cosLat), 0.01))
  return [lat + dLat, lng + dLng]
}

/** Meter pro Pixel am angegebenen Punkt (über Leaflet-Projektion, zoom-genau). */
function metersPerPixelAt(map: L.Map, lat: number, lng: number): number {
  const ll = L.latLng(lat, lng)
  const p = map.latLngToContainerPoint(ll)
  const ll2 = map.containerPointToLatLng(L.point(p.x + 100, p.y))
  return map.distance(ll, ll2) / 100
}

/**
 * Entfernung vom Ursprung bis zum sichtbaren Kartenrand in Kompassrichtung (Meter).
 * `visibleScale` < 1: bei Live-Rotation ist der Leaflet-Container √2 größer als der Viewport.
 */
function distanceToMapEdgeMeters(
  map: L.Map,
  originLat: number,
  originLng: number,
  compassDeg: number,
  insetPx = 28,
  visibleScale = 1
): number {
  const origin = L.latLng(originLat, originLng)
  const size = map.getSize()
  if (size.x < 8 || size.y < 8) {
    // Layout noch nicht fertig – sinnvolle Mindestlänge statt unsichtbarer 8-m-Striche
    return 40
  }

  const originPt = map.latLngToContainerPoint(origin)
  const centerPt = L.point(size.x / 2, size.y / 2)
  const visHalfX = (size.x * visibleScale) / 2
  const visHalfY = (size.y * visibleScale) / 2
  const minX = centerPt.x - visHalfX + insetPx
  const maxX = centerPt.x + visHalfX - insetPx
  const minY = centerPt.y - visHalfY + insetPx
  const maxY = centerPt.y + visHalfY - insetPx

  const rad = (compassDeg * Math.PI) / 180
  // Bildschirm: +x = Ost, +y = Süd; Kompass 0 = Nord = −y
  const dirX = Math.sin(rad)
  const dirY = -Math.cos(rad)

  let t = Number.POSITIVE_INFINITY
  if (dirX > 1e-9) t = Math.min(t, (maxX - originPt.x) / dirX)
  else if (dirX < -1e-9) t = Math.min(t, (minX - originPt.x) / dirX)
  if (dirY > 1e-9) t = Math.min(t, (maxY - originPt.y) / dirY)
  else if (dirY < -1e-9) t = Math.min(t, (minY - originPt.y) / dirY)

  const fallback = Math.min(visHalfX, visHalfY) - insetPx
  if (!Number.isFinite(t) || t <= 4) {
    t = Math.max(24, fallback)
  } else {
    // Labels klar innerhalb des Viewports halten
    t = Math.max(24, Math.min(t, fallback * 1.05))
  }

  const edgePt = L.point(originPt.x + dirX * t, originPt.y + dirY * t)
  const meters = map.distance(origin, map.containerPointToLatLng(edgePt))
  // Mindestens ~25 % der kürzeren Viewport-Seite in Metern
  const mpp = metersPerPixelAt(map, originLat, originLng)
  const minMeters = Math.max(20, Math.min(visHalfX, visHalfY) * 0.45 * mpp)
  return Math.max(minMeters, meters)
}

function createCachedSatelliteLayer(
  onStatus: (ok: boolean, detail?: string) => void
): L.TileLayer {
  let okCount = 0
  let failCount = 0
  let lastReportedOk: boolean | null = null

  const report = (ok: boolean, detail?: string) => {
    // Nicht bei jeder einzelnen Kachel den Parent re-rendern – sonst Layer-Destroy-Loop
    if (ok) {
      okCount++
      failCount = 0
      if (lastReportedOk === true) return
      lastReportedOk = true
      onStatus(true)
      return
    }
    failCount++
    // Erst melden, wenn mehrere Kacheln scheitern (vereinzelte Fehler sind normal)
    if (okCount > 0 && failCount < 8) return
    if (lastReportedOk === false) return
    if (failCount < 4) return
    lastReportedOk = false
    onStatus(false, detail)
  }

  const CachedLayer = L.TileLayer.extend({
    createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
      const img = document.createElement('img')
      img.alt = ''
      img.setAttribute('role', 'presentation')
      // Kein crossOrigin: auf iOS/Android scheitern Esri-Kacheln sonst oft an CORS,
      // obwohl <img src> ohne CORS-Attribute zuverlässig lädt.
      const url = this.getTileUrl(coords)

      const ok = () => {
        report(true)
        done(undefined, img)
      }
      const fail = (detail: string) => {
        report(false, detail)
        done(new Error(detail), img)
      }

      const showBlob = async (res: Response) => {
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          ok()
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          fail('Satelliten-Kachel fehlerhaft')
        }
        img.src = objectUrl
      }

      void (async () => {
        try {
          const offline =
            typeof navigator !== 'undefined' && navigator.onLine === false

          if (offline) {
            const cached = await getCachedSatelliteTile(url)
            if (!cached) {
              fail('Satellitenbild offline nicht im Cache')
              return
            }
            await showBlob(cached)
            return
          }

          // Online: nur <img src> – kein paralleles CORS-fetch (spart Bandbreite/CPU auf Mobil)
          img.onload = () => ok()
          img.onerror = () => fail('Satellitenbild nicht ladbar')
          img.src = url
        } catch {
          fail('Satellitenbild nicht ladbar')
        }
      })()

      return img
    },
  }) as unknown as typeof L.TileLayer

  return new CachedLayer(ESRI_WORLD_IMAGERY_URL, {
    attribution: ESRI_WORLD_IMAGERY_ATTRIBUTION,
    minZoom: SATELLITE_MIN_ZOOM,
    maxZoom: SATELLITE_MAX_ZOOM,
    maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
    // Weniger Tile-Churn beim Zoomen/Pannen (mobil)
    updateWhenZooming: false,
    keepBuffer: 2,
    detectRetina: false,
  })
}

function createOsmLayer(): L.TileLayer {
  return L.tileLayer(DE_OSM_TILE_URL, {
    attribution: DE_OSM_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: OSM_MAX_ZOOM,
    maxNativeZoom: OSM_MAX_ZOOM,
  })
}

type SunOverlay = {
  sunriseAz: number
  noonAz: number
  sunsetAz: number
  currentAz: number
  currentAlt: number
  sunriseLabel: string
  noonLabel: string
  sunsetLabel: string
  currentLabel: string | null
  isPolarNight: boolean
  isPolarDay: boolean
}

function computeSunOverlay(
  lat: number,
  lng: number,
  /** Kalendertag für Auf-/Untergang/Mittag (Planung); ohne = heute */
  date?: Date,
  /** Echte „Jetzt“-Zeit für den aktuellen Sonnenstand */
  now: Date = new Date()
): SunOverlay | null {
  try {
    // Tageszeiten immer für den gewählten Kalendertag (Mitte des Tages → korrekter Tag in TZ)
    const day = date ? new Date(date) : new Date(now)
    day.setHours(12, 0, 0, 0)
    const times = SunCalc.getTimes(day, lat, lng)
    const sunrise = times.sunrise
    const sunset = times.sunset
    const solarNoon = times.solarNoon

    // „Sonne jetzt“ = echte Uhrzeit, wenn Vor Ort oder Planungsdatum = heute
    const showLive = !date || sameCalendarDay(day, now)
    const nowPos = showLive ? SunCalc.getPosition(now, lat, lng) : null

    const isValidTime = (d: Date | null | undefined): d is Date =>
      !!d && !Number.isNaN(d.getTime())

    const isPolar =
      !isValidTime(sunrise) ||
      !isValidTime(sunset) ||
      sunrise.getTime() === sunset.getTime()
    const refAlt = nowPos?.altitude ?? SunCalc.getPosition(solarNoon ?? day, lat, lng).altitude
    const isPolarDay = isPolar && refAlt > 0
    const isPolarNight = isPolar && refAlt <= 0

    const sunriseAz = isValidTime(sunrise)
      ? suncalcAzimuthToCompass(SunCalc.getPosition(sunrise, lat, lng).azimuth)
      : 0
    const sunsetAz = isValidTime(sunset)
      ? suncalcAzimuthToCompass(SunCalc.getPosition(sunset, lat, lng).azimuth)
      : 0
    const noonAz = isValidTime(solarNoon)
      ? suncalcAzimuthToCompass(SunCalc.getPosition(solarNoon, lat, lng).azimuth)
      : 180
    const currentAz = nowPos ? suncalcAzimuthToCompass(nowPos.azimuth) : noonAz

    return {
      sunriseAz,
      noonAz,
      sunsetAz,
      currentAz,
      currentAlt: nowPos ? nowPos.altitude : -1,
      sunriseLabel: isValidTime(sunrise) && !isPolar ? format(sunrise, 'HH:mm') : '—',
      noonLabel: isValidTime(solarNoon) ? format(solarNoon, 'HH:mm') : '—',
      sunsetLabel: isValidTime(sunset) && !isPolar ? format(sunset, 'HH:mm') : '—',
      currentLabel: nowPos ? `Jetzt ${format(now, 'HH:mm')}` : null,
      isPolarDay: !!isPolarDay,
      isPolarNight: !!isPolarNight,
    }
  } catch {
    return null
  }
}

const BRAND_GREEN = 'rgb(45,79,30)'
const BRAND_ORANGE = 'rgb(230,126,34)'

type SunLabelKind = 'sunrise' | 'noon' | 'sunset' | 'now'

/** Kompass-Symbole: Aufgang (Halbkreis unten + Horizont + Pfeil hoch) / Untergang (spiegelverkehrt). */
function compassSunIconSvg(kind: 'sunrise' | 'sunset', color: string): string {
  if (kind === 'sunrise') {
    return `<svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" style="display:block;flex-shrink:0">
      <g transform="translate(7,8)">
        <path d="M 3.2 0 A 3.2 3.2 0 0 0 -3.2 0" fill="${color}"/>
        <path d="M-4.4 0 L4.4 0" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>
        <polygon points="0,-1.5 0.45,0.25 -0.45,0.25" fill="${color}"/>
      </g>
    </svg>`
  }
  return `<svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" style="display:block;flex-shrink:0">
    <g transform="translate(7,6)">
      <path d="M -3.2 0 A 3.2 3.2 0 0 1 3.2 0" fill="${color}"/>
      <path d="M-4.4 0 L4.4 0" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>
      <polygon points="0,1.5 0.45,-0.25 -0.45,-0.25" fill="${color}"/>
    </g>
  </svg>`
}

/** Eine lesbare Pill: Icon + kompletter Text in einer Zeile. */
function sunLabelIcon(kind: SunLabelKind, text: string, scale = 1): L.DivIcon {
  const iconHtml =
    kind === 'sunrise' || kind === 'sunset'
      ? compassSunIconSvg(kind, BRAND_GREEN)
      : kind === 'noon'
        ? `<svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" style="display:block;flex-shrink:0"><circle cx="7" cy="7" r="3" fill="${BRAND_ORANGE}"/><g stroke="${BRAND_ORANGE}" stroke-width="1.3" stroke-linecap="round"><path d="M7 1.5v1.6M7 10.9v1.6M1.5 7h1.6M10.9 7h1.6"/></g></svg>`
        : `<svg width="10" height="10" viewBox="0 0 14 14" aria-hidden="true" style="display:block;flex-shrink:0"><circle cx="7" cy="7" r="3.2" fill="${BRAND_ORANGE}"/></svg>`

  const fontPx = Math.max(9, Math.round(10 * scale))
  const padY = Math.round(3 * scale)
  const padX = Math.round(7 * scale)

  return L.divIcon({
    className: 'sonnen-map-sun-label',
    html: `<div style="
      transform:translate(-50%,-50%);
      display:inline-flex;align-items:center;gap:4px;
      max-width:none;
      padding:${padY}px ${padX}px;
      border-radius:999px;
      background:rgba(255,255,255,.96);
      border:1px solid rgba(45,79,30,.14);
      box-shadow:0 1px 3px rgba(0,0,0,.12);
      pointer-events:none;
      white-space:nowrap;
    ">
      ${iconHtml}
      <span style="
        font:600 ${fontPx}px/1.2 system-ui,-apple-system,sans-serif;
        color:${BRAND_GREEN};
        font-variant-numeric:tabular-nums;
        letter-spacing:0.01em;
      ">${text}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Dezenter Nord-Hinweis: kleiner Pfeil + N, keine Linie. */
function northMarkerIcon(scale = 1): L.DivIcon {
  const size = Math.max(22, Math.round(26 * scale))
  const fontPx = Math.max(9, Math.round(10 * scale))
  return L.divIcon({
    className: 'sonnen-map-north-marker',
    html: `<div style="
      transform:translate(-50%,-50%);
      display:flex;flex-direction:column;align-items:center;gap:1px;
      pointer-events:none;opacity:.72;
      filter:drop-shadow(0 1px 1px rgba(255,255,255,.85));
    ">
      <svg width="${Math.round(size * 0.45)}" height="${Math.round(size * 0.4)}" viewBox="0 0 12 10" aria-hidden="true">
        <path d="M6 1.2 L10.2 8.2 H1.8 Z" fill="${BRAND_GREEN}" fill-opacity=".55"/>
      </svg>
      <span style="
        font:700 ${fontPx}px/1 system-ui,-apple-system,sans-serif;
        letter-spacing:.06em;
        color:${BRAND_GREEN};
      ">N</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/**
 * Hersteller-Grundrisse sind meist Querformat (Länge = Bildbreite).
 * Unser Modell: Länge lokal entlang +Y (Bug = Nord bei heading 0).
 * Deshalb Querformat um +90° drehen, Hochformat unverändert.
 */
function caravanImageIcon(
  imageUrl: string,
  lengthPx: number,
  widthPx: number,
  headingDeg: number,
  interactive: boolean,
  imageIsLandscape: boolean
): L.DivIcon {
  // Box vor Heading-Drehung: Querformat → Länge horizontal; Hochformat → Länge vertikal
  const boxW = Math.max(8, Math.round(imageIsLandscape ? lengthPx : widthPx))
  const boxH = Math.max(8, Math.round(imageIsLandscape ? widthPx : lengthPx))
  const orientOffset = imageIsLandscape ? 90 : 0
  const rot = normalizeHeadingDeg(headingDeg + orientOffset)
  return L.divIcon({
    className: 'sonnen-caravan-image',
    html: `<div style="
      width:${boxW}px;height:${boxH}px;
      transform:rotate(${rot}deg);
      transform-origin:center center;
      cursor:${interactive ? 'grab' : 'default'};
      pointer-events:${interactive ? 'auto' : 'none'};
      will-change:transform;
    ">
      <img src="${imageUrl}" alt="" draggable="false" style="
        width:100%;height:100%;
        object-fit:fill;
        image-rendering:auto;
        opacity:.94;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));
        pointer-events:none;
        user-select:none;
        -webkit-user-drag:none;
      "/>
    </div>`,
    iconSize: [boxW, boxH],
    iconAnchor: [boxW / 2, boxH / 2],
  })
}

export function SonnenAusrichtungMap({
  center,
  mode,
  basemap,
  onSatelliteUnavailable,
  onSatelliteAvailable,
  deviceHeading = null,
  date,
  pin = null,
  onMapClick,
  caravan = null,
  caravanDraggable = false,
  lockMapPan = false,
  onCaravanMove,
  className,
  heightClassName = 'h-[420px] md:h-[580px]',
}: SonnenAusrichtungMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.TileLayer | null>(null)
  const pinRef = useRef<L.Marker | null>(null)
  const caravanPolyRef = useRef<L.Polygon | null>(null)
  const caravanMarkerRef = useRef<L.Marker | null>(null)
  const sunLayerRef = useRef<L.LayerGroup | null>(null)
  /** Kontinuierliche Heading-Summe für CSS-rotate (kein 0/360-Sprung) */
  const unwrappedHeadingRef = useRef<number | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapRotationDeg, setMapRotationDeg] = useState(0)
  const [zoomTick, setZoomTick] = useState(0)
  const [nowTick, setNowTick] = useState(() => Date.now())
  /** naturalWidth/Height des Grundriss-Bildes für korrekte Orientierung */
  const [imageNatural, setImageNatural] = useState<{
    url: string
    w: number
    h: number
  } | null>(null)
  const statusRef = useRef<{ ok: boolean; detail?: string }>({ ok: true })
  const onSatelliteUnavailableRef = useRef(onSatelliteUnavailable)
  onSatelliteUnavailableRef.current = onSatelliteUnavailable
  const onSatelliteAvailableRef = useRef(onSatelliteAvailable)
  onSatelliteAvailableRef.current = onSatelliteAvailable

  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onCaravanMoveRef = useRef(onCaravanMove)
  onCaravanMoveRef.current = onCaravanMove
  const caravanRefProps = useRef(caravan)
  caravanRefProps.current = caravan

  // „Sonne jetzt“ minütlich aktualisieren (auch in Planung, wenn Datum = heute)
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const sun = useMemo(
    () => computeSunOverlay(center.lat, center.lng, date, new Date(nowTick)),
    [center.lat, center.lng, date, nowTick]
  )

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: SATELLITE_MAX_ZOOM,
      minZoom: 3,
    }).setView([center.lat, center.lng], SATELLITE_DEFAULT_ZOOM)

    mapRef.current = map
    if (!map.getPane('sunPane')) {
      const sunPane = map.createPane('sunPane')
      sunPane.style.zIndex = '650'
      sunPane.style.pointerEvents = 'none'
    }
    sunLayerRef.current = L.layerGroup([], { pane: 'sunPane' }).addTo(map)
    setMapReady(true)

    // Nach Layout: Größe korrekt messen (wichtig bei rotiertem/vergrößertem Wrapper)
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false })
      setZoomTick((z) => z + 1)
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng)
    })
    const onViewChange = () => setZoomTick((z) => z + 1)
    map.on('zoomend', onViewChange)
    map.on('zoom', onViewChange)
    map.on('moveend', onViewChange)
    map.on('resize', onViewChange)

    return () => {
      map.off('zoomend', onViewChange)
      map.off('zoom', onViewChange)
      map.off('moveend', onViewChange)
      map.off('resize', onViewChange)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      pinRef.current = null
      caravanPolyRef.current = null
      caravanMarkerRef.current = null
      sunLayerRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [])

  // Grundriss-Bildmaße laden (Quer- vs. Hochformat)
  useEffect(() => {
    const url = caravan?.imageUrl
    if (!url) {
      setImageNatural(null)
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setImageNatural({ url, w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      if (!cancelled) setImageNatural(null)
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [caravan?.imageUrl])

  // Basemap: Satellit oder OSM – Callbacks bewusst per Ref, sonst Layer-Recreate-Loop
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    statusRef.current = { ok: true }

    if (basemap === 'satellite') {
      const layer = createCachedSatelliteLayer((ok, detail) => {
        const prev = statusRef.current
        statusRef.current = { ok, detail }
        if (ok && !prev.ok) onSatelliteAvailableRef.current?.()
        if (!ok && prev.ok) {
          onSatelliteUnavailableRef.current?.(detail ?? 'Satellitenbild nicht verfügbar')
        }
      })
      layer.addTo(map)
      layerRef.current = layer
      map.setMaxZoom(SATELLITE_MAX_ZOOM)
    } else {
      const layer = createOsmLayer()
      layer.addTo(map)
      layerRef.current = layer
      map.setMaxZoom(Math.max(OSM_MAX_ZOOM, 20))
      if (map.getZoom() > OSM_MAX_ZOOM + 1) {
        map.setZoom(OSM_MAX_ZOOM)
      }
      onSatelliteAvailableRef.current?.()
    }
  }, [basemap, mapReady])

  // Center (Zoom beibehalten) – ohne animate, sonst graues Aufblitzen beim Layer-Aufbau
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const z = map.getZoom()
    map.setView(
      [center.lat, center.lng],
      Number.isFinite(z) ? z : SATELLITE_DEFAULT_ZOOM,
      { animate: false }
    )
  }, [center.lat, center.lng, mapReady])

  /**
   * Live-Ansicht: gesamten Karten-Container um die Viewport-Mitte drehen.
   * Nicht mapPane – Leaflet schreibt dort translate3d fürs Panning.
   * Wrapper √2 größer, damit rotierte Ecken die Viewport-Fläche füllen.
   * Rotation kontinuierlich (shortestAngleDiff), ohne CSS-Transition –
   * sonst Springen beim Nord-Übergang 359°→0°.
   */
  const headingUp =
    mode === 'vor-ort' && deviceHeading != null && Number.isFinite(deviceHeading)
  const expandForRotation = mode === 'vor-ort'

  useEffect(() => {
    if (!headingUp || deviceHeading == null) {
      unwrappedHeadingRef.current = null
      setMapRotationDeg(0)
      return
    }
    const prev = unwrappedHeadingRef.current
    if (prev == null) {
      unwrappedHeadingRef.current = deviceHeading
    } else {
      unwrappedHeadingRef.current =
        prev + shortestAngleDiff(prev, deviceHeading)
    }
    setMapRotationDeg(-unwrappedHeadingRef.current)
  }, [headingUp, deviceHeading])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const id = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false })
      setZoomTick((z) => z + 1)
    })
    return () => window.cancelAnimationFrame(id)
  }, [mapReady, expandForRotation])

  // Karten-Pan nur im expliziten Verschieben-Modus sperren (Smartphone)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (lockMapPan) {
      map.dragging.disable()
    } else {
      map.dragging.enable()
    }
  }, [lockMapPan, mapReady])

  // Pin marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!pin) {
      if (pinRef.current) {
        map.removeLayer(pinRef.current)
        pinRef.current = null
      }
      return
    }

    const icon = L.divIcon({
      className: 'sonnen-stellplatz-pin',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:rgb(230,126,34);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

    if (!pinRef.current) {
      pinRef.current = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 400, interactive: false }).addTo(map)
    } else {
      pinRef.current.setLatLng([pin.lat, pin.lng])
      pinRef.current.setIcon(icon)
    }
  }, [pin, mapReady])

  // Caravan: Bild oder Rechteck + optional Drag
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const clearCaravan = () => {
      if (caravanPolyRef.current) {
        map.removeLayer(caravanPolyRef.current)
        caravanPolyRef.current = null
      }
      if (caravanMarkerRef.current) {
        map.removeLayer(caravanMarkerRef.current)
        caravanMarkerRef.current = null
      }
    }

    if (!caravan) {
      clearCaravan()
      return
    }

    const heading = normalizeHeadingDeg(caravan.headingDeg)
    const latlngs = caravanOutlineToLatLngs(
      caravan.outline,
      caravan.center.lat,
      caravan.center.lng,
      heading
    )

    const hasImage =
      !!caravan.imageUrl &&
      caravan.lengthM != null &&
      caravan.widthM != null &&
      caravan.lengthM > 0 &&
      caravan.widthM > 0

    const modeKey = hasImage ? 'image' : 'poly'
    const prevMode = (caravanMarkerRef.current as L.Marker & { _sonnenMode?: string } | null)
      ?._sonnenMode
    if (prevMode && prevMode !== modeKey) {
      clearCaravan()
    }

    if (hasImage) {
      if (caravanPolyRef.current) {
        map.removeLayer(caravanPolyRef.current)
        caravanPolyRef.current = null
      }

      const mpp = metersPerPixelAt(map, caravan.center.lat, caravan.center.lng)
      const lengthPx = (caravan.lengthM as number) / mpp
      const widthPx = (caravan.widthM as number) / mpp
      // Bis natural size bekannt: Querformat annehmen (übliche Hersteller-Pläne)
      const imageIsLandscape =
        imageNatural?.url === caravan.imageUrl
          ? imageNatural.w >= imageNatural.h
          : true
      const icon = caravanImageIcon(
        caravan.imageUrl as string,
        lengthPx,
        widthPx,
        heading,
        caravanDraggable,
        imageIsLandscape
      )

      if (!caravanMarkerRef.current) {
        const marker = L.marker([caravan.center.lat, caravan.center.lng], {
          icon,
          draggable: caravanDraggable,
          zIndexOffset: 450,
          interactive: caravanDraggable,
        }).addTo(map)
        ;(marker as L.Marker & { _sonnenMode?: string })._sonnenMode = 'image'
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          onCaravanMoveRef.current?.(ll.lat, ll.lng)
        })
        caravanMarkerRef.current = marker
      } else {
        caravanMarkerRef.current.setLatLng([caravan.center.lat, caravan.center.lng])
        caravanMarkerRef.current.setIcon(icon)
        if (caravanMarkerRef.current.dragging) {
          if (caravanDraggable) caravanMarkerRef.current.dragging.enable()
          else caravanMarkerRef.current.dragging.disable()
        }
        caravanMarkerRef.current.options.interactive = caravanDraggable
      }
    } else {
      if (!caravanPolyRef.current) {
        caravanPolyRef.current = L.polygon(latlngs, {
          color: 'rgb(45,79,30)',
          weight: 2,
          fillColor: 'rgb(45,79,30)',
          fillOpacity: 0.35,
          interactive: false,
        }).addTo(map)
      } else {
        caravanPolyRef.current.setLatLngs(latlngs)
      }

      const dragIcon = L.divIcon({
        className: 'sonnen-caravan-drag',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:rgba(45,79,30,.85);border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,.35);
          cursor:${caravanDraggable ? 'grab' : 'default'};
          ${caravanDraggable ? '' : 'opacity:0;pointer-events:none;'}
        "></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      if (!caravanMarkerRef.current) {
        const marker = L.marker([caravan.center.lat, caravan.center.lng], {
          icon: dragIcon,
          draggable: caravanDraggable,
          zIndexOffset: 460,
          interactive: caravanDraggable,
          opacity: caravanDraggable ? 1 : 0,
        }).addTo(map)
        ;(marker as L.Marker & { _sonnenMode?: string })._sonnenMode = 'poly'
        marker.on('drag', () => {
          const ll = marker.getLatLng()
          const c = caravanRefProps.current
          if (!c || !caravanPolyRef.current) return
          const pts = caravanOutlineToLatLngs(
            c.outline,
            ll.lat,
            ll.lng,
            normalizeHeadingDeg(c.headingDeg)
          )
          caravanPolyRef.current.setLatLngs(pts)
        })
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          onCaravanMoveRef.current?.(ll.lat, ll.lng)
        })
        caravanMarkerRef.current = marker
      } else {
        caravanMarkerRef.current.setLatLng([caravan.center.lat, caravan.center.lng])
        caravanMarkerRef.current.setIcon(dragIcon)
        caravanMarkerRef.current.setOpacity(caravanDraggable ? 1 : 0)
        if (caravanMarkerRef.current.dragging) {
          if (caravanDraggable) caravanMarkerRef.current.dragging.enable()
          else caravanMarkerRef.current.dragging.disable()
        }
      }
    }
  }, [caravan, caravanDraggable, mapReady, zoomTick, imageNatural])

  // Sonne: Strahlen bis zum Kartenrand, Labels am Rand; Nord nur als dezenter Pfeil
  useEffect(() => {
    const group = sunLayerRef.current
    const map = mapRef.current
    if (!group || !map || !mapReady || !sun) return

    group.clearLayers()
    const origin = pin ?? center
    const zoom = map.getZoom()
    const labelScale = Math.max(0.85, Math.min(1, 0.7 + zoom * 0.015))

    const addRay = (
      az: number,
      color: string,
      kind: SunLabelKind,
      text: string,
      weight = 2,
      dash?: string
    ) => {
      // Live: Container √2 größer – gegen sichtbaren Viewport rechnen, Labels innen
      const visibleScale = expandForRotation ? 1 / Math.SQRT2 : 1
      const insetPx = expandForRotation ? 64 : 56
      const edgeM = distanceToMapEdgeMeters(
        map,
        origin.lat,
        origin.lng,
        az,
        insetPx,
        visibleScale
      )
      const meters = Math.max(24, edgeM)
      const end = offsetByCompassMeters(origin.lat, origin.lng, az, meters)
      const latlngs: [number, number][] = [
        [origin.lat, origin.lng],
        end,
      ]
      // Hellhalo + dunkler Konturstrich → lesbar auf Wiese und Satellit
      L.polyline(latlngs, {
        color: 'rgba(255,255,255,.92)',
        weight: weight + 3.5,
        opacity: 0.9,
        dashArray: dash,
        interactive: false,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)
      L.polyline(latlngs, {
        color: 'rgba(20,20,20,.35)',
        weight: weight + 1.75,
        opacity: 0.55,
        dashArray: dash,
        interactive: false,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)
      L.polyline(latlngs, {
        color,
        weight,
        opacity: 0.95,
        dashArray: dash,
        interactive: false,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)
      L.marker(end, {
        icon: sunLabelIcon(kind, text, labelScale),
        interactive: false,
        zIndexOffset: 600,
      }).addTo(group)
    }

    // Nord: nur kleiner Pfeil + N, nah am Zentrum
    const northVisible = expandForRotation ? 1 / Math.SQRT2 : 1
    const northEdge = distanceToMapEdgeMeters(
      map,
      origin.lat,
      origin.lng,
      0,
      16,
      northVisible
    )
    const northM = Math.min(28, northEdge * 0.18)
    const northPos = offsetByCompassMeters(origin.lat, origin.lng, 0, Math.max(12, northM))
    L.marker(northPos, {
      icon: northMarkerIcon(labelScale),
      interactive: false,
      zIndexOffset: 480,
    }).addTo(group)

    // Auf-/Untergang immer zeichnen, sobald Azimut berechenbar (nicht nur „nicht polar“)
    const hasRiseSet =
      Number.isFinite(sun.sunriseAz) &&
      Number.isFinite(sun.sunsetAz) &&
      sun.sunriseLabel !== '—' &&
      sun.sunsetLabel !== '—'

    if (!sun.isPolarNight) {
      if (hasRiseSet && !sun.isPolarDay) {
        addRay(
          sun.sunriseAz,
          BRAND_GREEN,
          'sunrise',
          `Aufgang ${sun.sunriseLabel}`,
          2.5,
          '6 5'
        )
        addRay(
          sun.sunsetAz,
          BRAND_GREEN,
          'sunset',
          `Untergang ${sun.sunsetLabel}`,
          2.5,
          '6 5'
        )
      }
      addRay(sun.noonAz, BRAND_ORANGE, 'noon', `Mittag ${sun.noonLabel}`, 2.5)
    }

    if (sun.currentLabel && sun.currentAlt > -0.1 && !sun.isPolarNight) {
      addRay(sun.currentAz, BRAND_ORANGE, 'now', sun.currentLabel, 3)
    }
  }, [sun, pin, center, mapReady, zoomTick, expandForRotation])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-border',
        heightClassName,
        className
      )}
    >
      <div
        className="absolute left-1/2 top-1/2 will-change-transform"
        style={{
          width: expandForRotation ? '141.4214%' : '100%',
          height: expandForRotation ? '141.4214%' : '100%',
          transform: headingUp
            ? `translate(-50%, -50%) rotate(${mapRotationDeg}deg)`
            : 'translate(-50%, -50%)',
        }}
      >
        <div ref={containerRef} className="h-full w-full bg-muted" />
      </div>

      {lockMapPan && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[500] flex justify-center px-3">
          <p className="rounded-md bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow">
            Wohnwagen ziehen · Karte vorübergehend fixiert
          </p>
        </div>
      )}
    </div>
  )
}

export { resolveCaravanOutline } from '@/lib/caravan-geometry'
