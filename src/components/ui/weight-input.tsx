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
      ? (Number.isInteger(value) ? String(value) : String(value))
      : (value ?? '')

  const displayValue = isFocused ? rawStr : formatWeightForDisplay(parsed ?? undefined)

  const handleFocus = () => setIsFocused(true)

  const handleBlur = () => {
    setIsFocused(false)
    const p = parseWeightInput(rawStr)
    if (p !== null) {
      const normalized = String(p)
      if (normalized !== rawStr) {
        onChange(normalized, p)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '')
    const parts = raw.split(/[.,]/)
    const lastComma = raw.lastIndexOf(',')
    const lastDot = raw.lastIndexOf('.')
    const sep: ',' | '.' = lastComma > lastDot ? ',' : '.'
    let sanitized: string
    if (parts.length <= 2) {
      sanitized =
        (parts[0] ?? '') +
        (parts[1] !== undefined
          ? sep + parts[1]
          : raw.endsWith(',') || raw.endsWith('.')
            ? sep
            : '')
    } else {
      const decPart = parts.slice(1).join('')
      sanitized = (parts[0] ?? '') + (decPart ? sep + decPart : '')
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
