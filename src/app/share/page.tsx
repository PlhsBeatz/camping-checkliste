'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShareTargetChooser } from '@/components/share-target-chooser'
import { BrandSpinner } from '@/components/brand-spinner'
import { PageShell } from '@/components/page-shell'
import { readShareSearchParams } from '@/lib/share-target'

function SharePageInner() {
  const searchParams = useSearchParams()
  const payload = useMemo(
    () => readShareSearchParams(searchParams),
    [searchParams]
  )

  return <ShareTargetChooser payload={payload} />
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <BrandSpinner label="Wird geladen…" />
        </PageShell>
      }
    >
      <SharePageInner />
    </Suspense>
  )
}
