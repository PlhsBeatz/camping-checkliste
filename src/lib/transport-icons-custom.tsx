import { createLucideIcon } from 'lucide-react'

/** Transportanhänger (Seitenansicht mit Deichsel) */
export const TransportTrailer = createLucideIcon('TransportTrailer', [
  ['path', { d: 'M2 10v4', key: 'hitch' }],
  ['path', { d: 'M2 12h4', key: 'tongue' }],
  ['path', { d: 'M6 9h11a1 1 0 0 1 1 1v5H6V9z', key: 'body' }],
  ['circle', { cx: '9', cy: '17', r: '2', key: 'wheel-left' }],
  ['circle', { cx: '16', cy: '17', r: '2', key: 'wheel-right' }],
])

/** Dachbox (Auto mit Box auf dem Dach) */
export const TransportRoofBox = createLucideIcon('TransportRoofBox', [
  ['rect', { x: '8', y: '4', width: '8', height: '4', rx: '1', key: 'roof-box' }],
  ['path', { d: 'M6 14h12', key: 'roof-line' }],
  ['path', { d: 'M6 14v4h12v-4', key: 'body' }],
  ['circle', { cx: '9', cy: '20', r: '2', key: 'wheel-left' }],
  ['circle', { cx: '15', cy: '20', r: '2', key: 'wheel-right' }],
])

/** Heckbox (Auto mit Koffer am Heck) */
export const TransportRearBox = createLucideIcon('TransportRearBox', [
  ['path', { d: 'M3 14h9v5H3z', key: 'cabin' }],
  ['path', { d: 'M5 14l2-3h5l2 3', key: 'roof' }],
  ['rect', { x: '12', y: '11', width: '9', height: '8', rx: '1', key: 'rear-box' }],
  ['circle', { cx: '7', cy: '21', r: '2', key: 'wheel-left' }],
  ['circle', { cx: '16', cy: '21', r: '2', key: 'wheel-right' }],
])
