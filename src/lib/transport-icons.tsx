'use client'

import {
  Bus,
  Car,
  Caravan,
  Truck,
  Van,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TransportRearBox,
  TransportRoofBox,
  TransportTrailer,
} from '@/lib/transport-icons-custom'

/** Aktive Auswahl in Transportmittel-Verwaltung */
export const TRANSPORT_ICON_KEYS = [
  'car',
  'caravan',
  'van',
  'bus',
  'container',
  'package',
  'box',
] as const
export type TransportIconKey = (typeof TRANSPORT_ICON_KEYS)[number]

/** Legacy-Schlüssel aus früheren Versionen (DB-Kompatibilität) */
const LEGACY_TRANSPORT_ICON_KEYS = ['truck'] as const
type LegacyTransportIconKey = (typeof LEGACY_TRANSPORT_ICON_KEYS)[number]
type AnyTransportIconKey = TransportIconKey | LegacyTransportIconKey

export const TRANSPORT_ICON_OPTIONS: Array<{
  key: TransportIconKey
  label: string
  Icon: LucideIcon
}> = [
  { key: 'car', label: 'Auto', Icon: Car },
  { key: 'caravan', label: 'Wohnwagen', Icon: Caravan },
  { key: 'van', label: 'Kastenwagen', Icon: Van },
  { key: 'bus', label: 'Wohnmobil', Icon: Bus },
  { key: 'container', label: 'Anhänger', Icon: TransportTrailer },
  { key: 'package', label: 'Dachbox', Icon: TransportRoofBox },
  { key: 'box', label: 'Heckbox', Icon: TransportRearBox },
]

const ICON_BY_KEY: Record<AnyTransportIconKey, LucideIcon> = {
  car: Car,
  caravan: Caravan,
  van: Van,
  bus: Bus,
  container: TransportTrailer,
  package: TransportRoofBox,
  box: TransportRearBox,
  truck: Truck,
}

export function isTransportIconKey(value: string | null | undefined): value is AnyTransportIconKey {
  return (
    !!value &&
    ([...TRANSPORT_ICON_KEYS, ...LEGACY_TRANSPORT_ICON_KEYS] as readonly string[]).includes(value)
  )
}

/** Standard-Icon anhand des Namens (Neuanlage / fehlende DB-Spalte). */
export function inferTransportIconFromName(name: string): TransportIconKey {
  const n = name.trim().toLowerCase()
  if (n.includes('dachbox')) return 'package'
  if (n.includes('heckbox')) return 'box'
  if (n.includes('anhänger') || n.includes('anhaenger') || n.includes('trailer')) return 'container'
  if (n.includes('wohnmobil')) return 'bus'
  if (n.includes('kastenwagen') || n.includes('van')) return 'van'
  if (n.includes('wohnwagen') || n.includes('caravan')) return 'caravan'
  if (n.includes('auto') || n.includes('pkw')) return 'car'
  return 'van'
}

export function resolveTransportIconKey(
  icon: string | null | undefined,
  name: string
): AnyTransportIconKey {
  if (isTransportIconKey(icon)) return icon
  return inferTransportIconFromName(name)
}

/** Für Formular-Auswahl: Legacy-Werte auf gültige Option mappen. */
export function resolveTransportIconKeyForForm(
  icon: string | null | undefined,
  name: string
): TransportIconKey {
  const key = resolveTransportIconKey(icon, name)
  if (key === 'truck') return 'van'
  return key
}

interface TransportIconProps {
  icon?: string | null
  name: string
  className?: string
  title?: string
}

export function TransportIcon({ icon, name, className, title }: TransportIconProps) {
  const key = resolveTransportIconKey(icon, name)
  const Icon = ICON_BY_KEY[key]
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center text-gray-400',
        className
      )}
      title={title ?? name}
      aria-label={title ?? name}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
    </span>
  )
}
