'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import {
  ChecklistenTool,
  type ChecklistenHeaderContext,
} from '@/components/checklisten-tool'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ChecklistenPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const headerTrailingRef = useRef<HTMLDivElement>(null)
  const [headerContext, setHeaderContext] = useState<ChecklistenHeaderContext>({
    subtitle: null,
    progress: null,
  })

  const onHeaderContextChange = useCallback((ctx: ChecklistenHeaderContext) => {
    setHeaderContext(prev => {
      if (
        prev.subtitle === ctx.subtitle &&
        prev.progress?.done === ctx.progress?.done &&
        prev.progress?.total === ctx.progress?.total
      ) {
        return prev
      }
      return ctx
    })
  }, [])

  const progressPct =
    headerContext.progress && headerContext.progress.total > 0
      ? Math.round(
          (headerContext.progress.done / headerContext.progress.total) * 100
        )
      : 0

  useEffect(() => {
    if (showNavSidebar) {
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
  }, [showNavSidebar])

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col gap-0">
          {/* Header - Sticky (wie Kategorien / Mitreisende) + Fortschritt */}
          <div className="sticky top-0 z-10 bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden shrink-0"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)] truncate">
                    Checklisten
                  </h1>
                  {headerContext.subtitle ? (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                      {headerContext.subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
              <div ref={headerTrailingRef} className="flex shrink-0 items-center justify-end min-h-9" />
            </div>
            {headerContext.progress && headerContext.progress.total > 0 ? (
              <div className="mt-3 space-y-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: 'rgb(45,79,30)',
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-accent flex-shrink-0">
                    {progressPct}%
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <Suspense
            fallback={
              <div className="text-muted-foreground py-12 text-center">
                Checklisten werden geladen…
              </div>
            }
          >
            <ChecklistenTool
              onHeaderContextChange={onHeaderContextChange}
              headerTrailingRef={headerTrailingRef}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
