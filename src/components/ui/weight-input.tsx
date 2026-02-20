'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn, formatWeightForDisplay, parseWeightInput } from '@/lib/utils'

interface WeightInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string | number | null | undefined
  onChange: (value: string, parsed: number | null) => void
  unit?: string
}

/**
 * Gewichtseingabe mit Tausendertrennzeichen in der Anzeige und kg-Suffix.
 * Der Benutzer gibt nur Ziffern ein; Tausendertrennzeichen und Maßeinheit sind reine Anzeige.
 */
export function WeightInput({
  value,
  onChange,
  unit = 'kg',
  className,
  ...props
}: WeightInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const parsed = typeof value === 'number' ? value : parseWeightInput(String(value ?? ''))
  const rawStr =
    typeof value === 'number'
      ? formatWeightForDisplay(value, 6)
      : (() => {
          const v = String(value ?? '')
          if (v.includes('.') && !v.includes(',')) {
            const p = parseWeightInput(v)
            return p != null ? formatWeightForDisplay(p, 6) : v
          }
          return v
        })()

  const displayValue = isFocused
    ? rawStr
    : formatWeightForDisplay(parsed ?? undefined, 6)

  const handleFocus = () => setIsFocused(true)

  const handleBlur = () => {
    setIsFocused(false)
    const p = parseWeightInput(rawStr)
    if (p !== null) {
      const commaFormatted = formatWeightForDisplay(p, 6)
      if (commaFormatted !== rawStr) {
        onChange(commaFormatted, p)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d,]/g, '')
    const parts = raw.split(',')
    let sanitized: string
    if (parts.length === 1) {
      sanitized = parts[0] ?? ''
      if (raw.endsWith(',')) sanitized += ','
    } else {
      const decPart = parts.slice(1).join('').slice(0, 6)
      sanitized = (parts[0] ?? '') + ',' + decPart
    }
    const p = parseWeightInput(sanitized)
    onChange(sanitized, p)
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className={cn(unit ? 'pr-10' : '')}
        {...props}
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  )
}
