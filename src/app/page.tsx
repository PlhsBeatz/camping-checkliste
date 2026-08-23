'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HeuteHub } from '@/components/heute-hub'

function HomeRedirect() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const vacation = searchParams.get('vacation')

  useEffect(() => {
    if (!vacation) return
    const params = new URLSearchParams(searchParams.toString())
    router.replace(`/packliste?${params.toString()}`)
  }, [vacation, searchParams, router])

  if (vacation) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">Weiter zur Packliste…</p>
    )
  }

  return <HeuteHub />
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground p-6 text-center">Laden…</p>}>
      <HomeRedirect />
    </Suspense>
  )
}
