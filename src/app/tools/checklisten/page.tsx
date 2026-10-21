'use client'

import { Suspense, useState, useCallback, useRef } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import {
  ChecklistenTool,
  type ChecklistenHeaderContext,
} from '@/components/checklisten-tool'

export default function ChecklistenPage() {
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

  return (
    <PageShell containerClassName="flex flex-col gap-0">
      <div className="sticky top-0 z-20 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
        <PageHeader
          sticky={false}
          title="Checklisten"
          subtitle={headerContext.subtitle ?? undefined}
          actions={
            <div
              ref={headerTrailingRef}
              className="flex shrink-0 items-center justify-end min-h-9"
            />
          }
        />
        {headerContext.progress && headerContext.progress.total > 0 ? (
          <div className="mt-3 space-y-2 px-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
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
    </PageShell>
  )
}
