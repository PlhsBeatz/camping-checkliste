'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildGmailBrowserSearchUrl } from '@/lib/gmail-links'

function GmailSucheContent() {
  const searchParams = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()
  const gmailUrl = useMemo(
    () => (query ? buildGmailBrowserSearchUrl(query) : null),
    [query]
  )
  const [status, setStatus] = useState<'redirect' | 'manual'>('redirect')

  useEffect(() => {
    if (!gmailUrl) return

    // Clientseitiger Redirect: #search bleibt erhalten (im Gegensatz zu
    // serverseitigen / Auth-Redirects, die Fragmente verwerfen).
    const t = window.setTimeout(() => {
      window.location.replace(gmailUrl)
    }, 150)

    // Falls die Weiterleitung nicht greift (Popup-Blocker o.ä.)
    const fallback = window.setTimeout(() => setStatus('manual'), 2500)

    return () => {
      window.clearTimeout(t)
      window.clearTimeout(fallback)
    }
  }, [gmailUrl])

  if (!query || !gmailUrl) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Gmail-Suche</h1>
        <p className="text-sm text-muted-foreground">
          Kein Suchbegriff übergeben. Bitte den Link erneut aus den
          Buchungsdetails öffnen.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Weiter zu Gmail…</h1>
      <p className="text-sm text-muted-foreground">
        {status === 'redirect'
          ? 'Die Suche wird im Browser geöffnet.'
          : 'Weiterleitung hat nicht geklappt – bitte manuell öffnen.'}
      </p>
      <p className="rounded-md border bg-muted/40 p-3 text-left font-mono text-xs text-foreground break-all">
        {query}
      </p>
      <Button asChild className="gap-2">
        <a href={gmailUrl} rel="noopener noreferrer">
          In Gmail öffnen
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </main>
  )
}

export default function GmailSuchePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6 text-sm text-muted-foreground">
          Lade…
        </main>
      }
    >
      <GmailSucheContent />
    </Suspense>
  )
}
