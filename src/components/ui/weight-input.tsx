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
    if (p !== null && String(p) !== rawStr) {
      onChange(String(p), p)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digitsAndDecimal = raw.replace(/[^\d.,]/g, '')
    const parts = digitsAndDecimal.split(/[.,]/)
    let sanitized: string
    if (parts.length <= 2) {
      sanitized = (parts[0] ?? '') + (parts[1] !== undefined ? '.' + parts[1] : '')
    } else {
      sanitized = (parts[0] ?? '') + '.' + (parts.slice(1).join('') ?? '')
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
