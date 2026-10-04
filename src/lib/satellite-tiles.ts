/** Esri World Imagery – Satellitenkacheln für Sonnenausrichtung (Attribution Pflicht). */

/** Aktueller Esri-Endpunkt (services.*); server.* leitet teils um und kann mobil scheitern. */
export const ESRI_WORLD_IMAGERY_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export const ESRI_WORLD_IMAGERY_ATTRIBUTION =
  'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'

/** Deutsche OSM-Kacheln (wie bei Campingplätzen / Urlaubskarte). */
export const DE_OSM_TILE_URL =
  'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'

export const DE_OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.de/faq.html">FOSSGIS</a>'

export const SATELLITE_MIN_ZOOM = 14
/** Überzoom über native Esri-Kacheln (maxNativeZoom 19) hinaus */
export const SATELLITE_MAX_ZOOM = 22
export const SATELLITE_MAX_NATIVE_ZOOM = 19
export const SATELLITE_DEFAULT_ZOOM = 20
export const OSM_MAX_ZOOM = 19

export const SATELLITE_PREF_KEY = 'sonnen-ausrichtung-satellite'
export const SONNEN_DISPLAY_PREF_KEY = 'sonnen-ausrichtung-display'
export const SONNEN_BASEMAP_PREF_KEY = 'sonnen-ausrichtung-basemap'

export type SonnenDisplayMode = 'karte' | 'kompass'
export type SonnenBasemap = 'satellite' | 'osm'

/** @deprecated Nutze readSonnenBasemapPref */
export function readSatellitePref(): boolean {
  return readSonnenBasemapPref() === 'satellite'
}

/** @deprecated Nutze writeSonnenBasemapPref */
export function writeSatellitePref(enabled: boolean): void {
  writeSonnenBasemapPref(enabled ? 'satellite' : 'osm')
}

export function readSonnenDisplayPref(): SonnenDisplayMode {
  if (typeof window === 'undefined') return 'karte'
  try {
    const raw = localStorage.getItem(SONNEN_DISPLAY_PREF_KEY)
    if (raw === 'kompass' || raw === 'karte') return raw
  } catch {
    // ignore
  }
  return 'karte'
}

export function writeSonnenDisplayPref(mode: SonnenDisplayMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SONNEN_DISPLAY_PREF_KEY, mode)
  } catch {
    // ignore
  }
}

export function readSonnenBasemapPref(): SonnenBasemap {
  if (typeof window === 'undefined') return 'satellite'
  try {
    const basemap = localStorage.getItem(SONNEN_BASEMAP_PREF_KEY)
    if (basemap === 'satellite' || basemap === 'osm') return basemap
    // Migration aus altem Satelliten-Schalter
    const legacy = localStorage.getItem(SATELLITE_PREF_KEY)
    if (legacy === '0' || legacy === 'false') return 'osm'
  } catch {
    // ignore
  }
  return 'satellite'
}

export function writeSonnenBasemapPref(basemap: SonnenBasemap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SONNEN_BASEMAP_PREF_KEY, basemap)
    localStorage.setItem(SATELLITE_PREF_KEY, basemap === 'satellite' ? '1' : '0')
  } catch {
    // ignore
  }
}

export function satelliteTileUrl(z: number, x: number, y: number): string {
  return ESRI_WORLD_IMAGERY_URL.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}
