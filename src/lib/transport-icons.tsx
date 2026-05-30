'use client'

import { Bus, Car, Caravan, Truck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TRANSPORT_ICON_KEYS = ['caravan', 'car', 'truck', 'bus'] as const
export type TransportIconKey = (typeof TRANSPORT_ICON_KEYS)[number]

export const TRANSPORT_ICON_OPTIONS: Array<{
  key: TransportIconKey
  label: string
  Icon: LucideIcon
}> = [
  { key: 'caravan', label: 'Wohnwagen', Icon: Caravan },
  { key: 'car', label: 'Auto', Icon: Car },
  { key: 'truck', label: 'Sonstiges', Icon: Truck },
  { key: 'bus', label: 'Bus', Icon: Bus },
]

const ICON_BY_KEY: Record<TransportIconKey, LucideIcon> = {
  caravan: Caravan,
  car: Car,
  truck: Truck,
  bus: Bus,
}

export function isTransportIconKey(value: string | null | undefined): value is TransportIconKey {
  return !!value && (TRANSPORT_ICON_KEYS as readonly string[]).includes(value)
}

/** Standard-Icon anhand des Namens (Neuanlage / fehlende DB-Spalte). */
export function inferTransportIconFromName(name: string): TransportIconKey {
  const n = name.trim().toLowerCase()
  if (n.includes('wohnwagen') || n.includes('caravan')) return 'caravan'
  if (n.includes('auto') || n.includes('pkw')) return 'car'
  if (n.includes('bus')) return 'bus'
  return 'truck'
}

export function resolveTransportIconKey(
  icon: string | null | undefined,
  name: string
): TransportIconKey {
  if (isTransportIconKey(icon)) return icon
  return inferTransportIconFromName(name)
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
