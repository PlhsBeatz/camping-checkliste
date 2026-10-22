'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { cn } from '@/lib/utils'

type PageShellContextValue = {
  openNav: () => void
  closeNav: () => void
}

const PageShellContext = createContext<PageShellContextValue | null>(null)

/** Nav-Öffnen für PageHeader (nur innerhalb von PageShell). */
export function usePageShell(): PageShellContextValue {
  const ctx = useContext(PageShellContext)
  if (!ctx) {
    throw new Error('usePageShell muss innerhalb von PageShell verwendet werden')
  }
  return ctx
}

interface PageShellProps {
  children: ReactNode
  /** Portale/Modals außerhalb der Content-Spalte */
  afterContent?: ReactNode
  /** Klassen auf der Spalte neben der Sidebar (`lg:ml-[280px]`) */
  contentClassName?: string
  /** Klassen auf dem inneren `container` */
  containerClassName?: string
  /** Kein container-Wrapper – Content füllt die Spalte selbst */
  bare?: boolean
}

/**
 * Kanonisches App-Chrome: Sidebar + Content-Spalte + Body-Scroll-Lock bei offenem Menü.
 * Einstellungen/Stammdaten: ConfigPageLayout (baut intern darauf auf).
 */
export function PageShell({
  children,
  afterContent,
  contentClassName,
  containerClassName,
  bare = false,
}: PageShellProps) {
  const [showNav, setShowNav] = useState(false)
  const openNav = useCallback(() => setShowNav(true), [])
  const closeNav = useCallback(() => setShowNav(false), [])

  useEffect(() => {
    if (showNav) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNav])

  const ctx = useMemo(
    () => ({ openNav, closeNav }),
    [openNav, closeNav]
  )

  return (
    <PageShellContext.Provider value={ctx}>
      {/* min-h-dvh statt min-h-screen: 100vh ist im Mobile-Browser oft höher als
          der sichtbare Bereich (URL-Leiste) → leichter Geister-Scroll bei wenig Content. */}
      <div className="flex min-h-dvh max-w-full overflow-x-clip">
        <NavigationSidebar isOpen={showNav} onClose={closeNav} />

        <div
          className={cn(
            'flex-1 min-h-dvh min-w-0 transition-all duration-300',
            'lg:ml-[280px]',
            contentClassName
          )}
        >
          {bare ? (
            children
          ) : (
            <div
              className={cn(
                'container mx-auto p-4 md:p-6 max-w-full',
                containerClassName
              )}
            >
              {children}
            </div>
          )}
        </div>

        {afterContent}
      </div>
    </PageShellContext.Provider>
  )
}
