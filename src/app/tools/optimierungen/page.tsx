'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { OptimierungenTool } from '@/components/optimierungen-tool'
import { useAuth } from '@/components/auth-provider'

export default function OptimierungenPage() {
  const { canReadOptimierung, canWriteOptimierung, loading } = useAuth()
  const router = useRouter()
  const headerTrailingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return
    if (!canReadOptimierung) {
      router.replace('/')
    }
  }, [loading, canReadOptimierung, router])

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

      <OptimierungenTool headerTrailingRef={headerTrailingRef} canWrite={canWriteOptimierung} />
    </PageShell>
  )
}
