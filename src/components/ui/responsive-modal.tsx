'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

/** Breakpoint: sm = 640px - Drawer unterhalb, Dialog oberhalb */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    const onChange = () => setIsMobile(mql.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}

export interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  /** Zusätzliche Klassen für den Content-Container (Dialog/Drawer) */
  contentClassName?: string
  /** Für komplexe Layouts: kein Standard-Padding, Header mit Border */
  noPadding?: boolean
  /** Komplett eigenes Layout – Kinder werden direkt gerendert, kein Header/Scroll-Wrapper */
  customContent?: boolean
}

/**
 * Responsive Modal: Drawer auf Smartphone (<640px), Dialog auf Desktop.
 * Für Neu- und Bearbeiten-Formulare optimiert.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title = '',
  description,
  children,
  contentClassName,
  noPadding,
  customContent = false,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (customContent) {
    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className={cn('max-h-[90vh] flex flex-col p-0', contentClassName)}>
            {children}
          </DrawerContent>
        </Drawer>
      )
    }
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('p-0', contentClassName)}>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            'max-h-[90vh] flex flex-col',
            noPadding ? 'p-0' : 'px-6 pb-6',
            contentClassName
          )}
        >
          <DrawerHeader className={noPadding ? 'px-6 pt-6 pb-4 border-b text-left' : ''}>
            <DrawerTitle className="text-left">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-left">{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className={cn('flex-1 overflow-y-auto min-h-0', !noPadding && 'px-6 pb-6')}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
