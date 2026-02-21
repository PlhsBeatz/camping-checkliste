import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-muted">
            <WifiOff className="w-16 h-16 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold">Sie sind offline</h1>
        <p className="text-muted-foreground">
          Diese Seite ist nicht im Offline-Cache verfügbar. Wenn Sie die App
          bereits genutzt haben, können Sie zur Startseite wechseln – dort sind
          Ihre zuletzt besuchten Packlisten und Daten offline verfügbar.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}
