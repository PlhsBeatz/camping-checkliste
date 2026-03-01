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

const DRAWER_STATE_KEY = 'responsive_modal_drawer'

/** Stack der geöffneten Drawer (zuletzt geöffneter = oben). Nur der oberste reagiert auf Zurück. */
const drawerCloseStack: Array<() => void> = []

function handleDrawerPopState() {
  const closeTop = drawerCloseStack.pop()
  if (closeTop) closeTop()
}

let globalPopstateListenerAdded = false
function ensureGlobalPopstateListener() {
  if (typeof window === 'undefined' || globalPopstateListenerAdded) return
  globalPopstateListenerAdded = true
  window.addEventListener('popstate', handleDrawerPopState)
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
const OPEN_GRACE_MS = 350

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
  const openedAtRef = React.useRef<number>(0)
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  if (open && isMobile) {
    openedAtRef.current = Date.now()
  }

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isMobile && open) {
        const elapsed = Date.now() - openedAtRef.current
        if (elapsed < OPEN_GRACE_MS) return
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, isMobile, open]
  )

  // Smartphone Zurück-Button: nur der zuletzt geöffnete Drawer schließt (Stack für verschachtelte Drawer)
  React.useEffect(() => {
    if (!open || !isMobile || typeof window === 'undefined') return

    const close = () => onOpenChangeRef.current(false)
    drawerCloseStack.push(close)
    ensureGlobalPopstateListener()

    const state = { ...(window.history.state || {}), [DRAWER_STATE_KEY]: true }
    window.history.pushState(state, '')

    return () => {
      const idx = drawerCloseStack.indexOf(close)
      if (idx !== -1) drawerCloseStack.splice(idx, 1)
    }
  }, [open, isMobile])

  if (customContent) {
    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className={cn('max-h-[90vh] flex flex-col p-0', contentClassName)}>
            {children}
          </DrawerContent>
        </Drawer>
      )
    }
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={cn('p-0', contentClassName)}>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          className={cn(
            'max-h-[90vh] flex flex-col w-full max-w-[100vw]',
            noPadding ? 'p-0' : 'p-0',
            contentClassName
          )}
        >
          <DrawerHeader className={noPadding ? 'px-6 pt-6 pb-4 border-b text-left' : 'px-6 pt-6 pb-4 border-b text-left'}>
            <DrawerTitle className="text-left">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-left">{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className={cn('flex-1 overflow-y-auto min-h-0 overscroll-y-none', !noPadding && 'px-6 pb-6')}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
