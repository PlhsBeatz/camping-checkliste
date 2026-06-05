'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const THEME_OPTIONS = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

interface ThemeToggleProps {
  className?: string
  variant?: 'default' | 'sidebar'
}

export function ThemeToggle({ className, variant = 'default' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = theme ?? 'light'
  const ActiveIcon =
    activeTheme === 'system'
      ? Monitor
      : (resolvedTheme ?? 'light') === 'dark'
        ? Moon
        : Sun

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('w-full justify-start gap-2', className)}
        disabled
        aria-label="Darstellung wird geladen"
      >
        <Sun className="h-4 w-4" />
        <span className="text-xs tracking-wide">DARSTELLUNG</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === 'sidebar' ? 'ghost' : 'outline'}
          size="sm"
          className={cn(
            'w-full justify-start gap-2',
            variant === 'sidebar' &&
              'text-gray-700 hover:bg-muted dark:text-muted-foreground',
            className
          )}
          aria-label="Darstellung wählen"
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
          <span className="text-xs tracking-wide">DARSTELLUNG</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={activeTheme} onValueChange={setTheme}>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="mr-2 h-4 w-4" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
