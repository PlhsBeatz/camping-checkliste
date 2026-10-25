import L from 'leaflet'

/** Pin-Maße: Anker liegt an der unteren Spitze. */
export const MAP_PIN_WIDTH = 32
export const MAP_PIN_HEIGHT = 40

export type MapPinColor = 'primary' | 'brand-orange' | 'accent' | 'destructive'

export type MapPinSymbol = 'home' | 'camping' | 'thumbsUp' | 'thumbsDown'

const COLOR_FILL: Record<MapPinColor, string> = {
  primary: 'hsl(var(--primary))',
  'brand-orange': 'hsl(var(--brand-orange))',
  accent: 'hsl(var(--accent))',
  destructive: 'hsl(var(--destructive-text))',
}

/** Innen-Symbole im 32×40-Koordinatenraum (weißer Kreis um cx=16, cy=13.6). */
function symbolMarkup(symbol: MapPinSymbol, fill: string): string {
  if (symbol === 'home') {
    return `<path d="M16 11.2 11.2 15v5.3H13V18h6v2.3h1.8V15L16 11.2Z" fill="${fill}"/>`
  }
  if (symbol === 'camping') {
    return `<path d="M11.2 19.8 16 12.5l4.8 7.3H13.8V22h4.4v-2.2H11.2Z" fill="${fill}"/>`
  }
  // Lucide-ähnliche Daumen-Icons (24×24), skaliert in den weißen Kreis
  const paths =
    symbol === 'thumbsUp'
      ? `<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>`
      : `<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>`
  return `<g transform="translate(16 13.6) scale(0.52) translate(-12 -12)" fill="none" stroke="${fill}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`
}

export function mapPinSvgHtml(color: MapPinColor, symbol: MapPinSymbol): string {
  const fill = COLOR_FILL[color]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_PIN_WIDTH}" height="${MAP_PIN_HEIGHT}" viewBox="0 0 32 40" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))">
    <path d="M16 40C16 40 1.8 21.6 1.8 13.6A14.2 14.2 0 1 1 30.2 13.6C30.2 21.6 16 40 16 40Z" fill="${fill}" stroke="white" stroke-width="1.5"/>
    <circle cx="16" cy="13.6" r="8.2" fill="white"/>
    ${symbolMarkup(symbol, fill)}
  </svg>`
}

export function createMapPinIcon(opts: { color: MapPinColor; symbol: MapPinSymbol }): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:${MAP_PIN_WIDTH}px;height:${MAP_PIN_HEIGHT}px;line-height:0">${mapPinSvgHtml(opts.color, opts.symbol)}</div>`,
    className: 'app-leaflet-pin',
    iconSize: [MAP_PIN_WIDTH, MAP_PIN_HEIGHT],
    iconAnchor: [MAP_PIN_WIDTH / 2, MAP_PIN_HEIGHT],
    popupAnchor: [0, -MAP_PIN_HEIGHT + 2],
  })
}
