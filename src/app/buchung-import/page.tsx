'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BuchungImportRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('bookingImport', '1')
    router.replace(`/urlaube?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Weiterleitung…
    </div>
  )
}

export default function BuchungImportRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Laden…
        </div>
      }
    >
      <BuchungImportRedirectInner />
    </Suspense>
  )
}
