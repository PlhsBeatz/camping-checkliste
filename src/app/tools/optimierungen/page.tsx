'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { OptimierungenTool } from '@/components/optimierungen-tool'
import type { OptimierungCreatePrefill } from '@/components/optimierung-edit-dialog'
import { useAuth } from '@/components/auth-provider'

function OptimierungenPageContent() {
  const { canReadOptimierung, canWriteOptimierung, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const headerTrailingRef = useRef<HTMLDivElement>(null)
  const [createPrefill, setCreatePrefill] = useState<OptimierungCreatePrefill | null>(null)

  const shareCreate = searchParams.get('share') === '1'

  useEffect(() => {
    if (loading) return
    if (!canReadOptimierung) {
      router.replace('/')
    }
  }, [loading, canReadOptimierung, router])

  useEffect(() => {
    if (!shareCreate || loading || !canWriteOptimierung) return
    const titel = searchParams.get('titel')?.trim() || ''
    const url = searchParams.get('url')?.trim() || ''
    setCreatePrefill({
      titel,
      links: url ? [url] : [],
      status: 'idee',
    })
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['share', 'titel', 'url']) params.delete(key)
    const qs = params.toString()
    router.replace(qs ? `/tools/optimierungen?${qs}` : '/tools/optimierungen', {
      scroll: false,
    })
  }, [shareCreate, loading, canWriteOptimierung, searchParams, router])

  const onCreatePrefillConsumed = useCallback(() => {
    setCreatePrefill(null)
  }, [])

  if (loading || !canReadOptimierung) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <PageShell containerClassName="flex flex-col gap-0">
      <PageHeader
        title="Optimierungen"
        subtitle="Ideen und geplante Anpassungen"
        actions={
          <div
            ref={headerTrailingRef}
            className="flex shrink-0 items-center justify-end min-h-9"
          />
        }
      />

      <OptimierungenTool
        headerTrailingRef={headerTrailingRef}
        canWrite={canWriteOptimierung}
        createPrefill={createPrefill}
        onCreatePrefillConsumed={onCreatePrefillConsumed}
      />
    </PageShell>
  )
}

export default function OptimierungenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Wird geladen…</p>
        </div>
      }
    >
      <OptimierungenPageContent />
    </Suspense>
  )
}
