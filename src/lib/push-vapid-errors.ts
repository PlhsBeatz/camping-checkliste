/** Nutzer-Hinweise, wenn VAPID auf dem Server nicht bereit ist (Client + Server). */

export type VapidConfigStatusHint = {
  publicKey?: string | null
  enabled?: boolean
  privateKeyConfigured?: boolean
  privateKeyParseFailed?: boolean
  keyPairMatch?: boolean
}

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function describeVapidSetupError(status: VapidConfigStatusHint): string {
  if (status.privateKeyParseFailed) {
    return isDevEnvironment()
      ? 'VAPID_PRIVATE_KEY ist kein gültiges JSON – in .dev.vars in einfache Anführungszeichen setzen.'
      : 'Der VAPID Private Key ist fehlerhaft (Cloudflare-Geheimnis als JSON-Zeile prüfen).'
  }

  if (!status.keyPairMatch && status.privateKeyConfigured && status.publicKey) {
    return 'VAPID Public- und Private-Key passen nicht zusammen – gleiches Schlüsselpaar verwenden.'
  }

  if (isDevEnvironment()) {
    return 'VAPID-Schlüssel fehlen in .dev.vars (pnpm dev neu starten).'
  }

  return 'Push ist auf dem Server noch nicht konfiguriert. VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT in Cloudflare (Variablen/Geheimnisse) setzen und neu deployen.'
}
