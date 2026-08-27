'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatBookingMoney, parseBookingMoneyInput } from '@/lib/booking-format'
import { cn } from '@/lib/utils'

const CHANGED_FIELD_RING =
  'ring-2 ring-accent-orange border-accent-orange focus-visible:ring-accent-orange'

export function CurrencyInput({
  value,
  currency,
  onChange,
  className,
  highlighted = false,
}: {
  value: number | null | undefined
  currency?: string | null
  onChange: (value: number | null) => void
  className?: string
  highlighted?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const displayValue = focused
    ? draft
    : value != null && Number.isFinite(value)
      ? formatBookingMoney(value, currency)
      : ''

  return (
    <Input
      inputMode="decimal"
      className={cn(className, highlighted && CHANGED_FIELD_RING)}
      value={displayValue}
      onFocus={() => {
        setFocused(true)
        setDraft(value != null && Number.isFinite(value) ? String(value) : '')
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseBookingMoneyInput(draft)
        onChange(parsed)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseBookingMoneyInput(e.target.value)
        if (parsed != null) onChange(parsed)
        else if (!e.target.value.trim()) onChange(null)
      }}
    />
  )
}
