'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { ConfigSubnav } from '@/components/config-subnav'
import { getActiveConfigItem } from '@/lib/config-navigation'
import { cn } from '@/lib/utils'

/**
 * Bereichswechsler für Mobilgeräte als Bottom-Sheet (App-Muster).
 * Nur auf Unterseiten – nicht auf /konfiguration.
 */
export function ConfigMobileSectionPicker() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const activeItem = getActiveConfigItem(pathname)

  if (!activeItem) return null

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border border-subtle',
          'bg-muted/40 px-4 py-3 text-left transition-colors active:bg-muted'
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(45,79,30)]/10 text-brand-heading"
          aria-hidden
        >
          <LayoutGrid className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Aktueller Bereich</span>
          <span className="block font-semibold text-brand-heading truncate">
            {activeItem.label}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-brand-heading">Konfiguration</DrawerTitle>
            <DrawerDescription>Bereich wechseln</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8 pt-1">
            <ConfigSubnav variant="mobile" onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
