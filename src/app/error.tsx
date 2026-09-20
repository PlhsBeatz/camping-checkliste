'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

function isChunkLoadError(error: Error): boolean {
  const message = error.message || ''
  return (
    error.name === 'ChunkLoadError' ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  )
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return
    const key = 'chunk-load-recovery'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Die App konnte diesen Bereich nicht laden. Oft hilft ein Neuladen –
        besonders nach einem Update.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Neu laden
        </Button>
        <Button variant="outline" onClick={reset}>
          Erneut versuchen
        </Button>
      </div>
    </div>
  )
}
