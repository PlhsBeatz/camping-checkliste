/** Nutzer-Hinweise, wenn VAPID auf dem Server nicht bereit ist (Client + Server). */

export type VapidDiagnostics = {
  cloudflareContextAvailable: boolean
  publicKeyFromProcessEnv: boolean
  publicKeyFromCloudflareEnv: boolean
  privateKeyFromProcessEnv: boolean
  privateKeyFromCloudflareEnv: boolean
  subjectFromProcessEnv: boolean
  subjectFromCloudflareEnv: boolean
}

export type VapidConfigStatusHint = {
  publicKey?: string | null
  enabled?: boolean
  privateKeyConfigured?: boolean
  privateKeyParseFailed?: boolean
  keyPairMatch?: boolean
  diagnostics?: VapidDiagnostics
}

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function describeVapidSetupError(status: VapidConfigStatusHint): string {
  if (status.privateKeyParseFailed) {
    return isDevEnvironment()
      ? 'VAPID_PRIVATE_KEY ist kein gültiges JSON – in .dev.vars in einfache Anführungszeichen setzen.'
      : 'Der VAPID Private Key ist fehlerhaft. Als Geheimnis (Text) eine JSON-Zeile eintragen, nicht den Typ „JSON“ im Dashboard.'
  }

  if (!status.keyPairMatch && status.privateKeyConfigured && status.publicKey) {
    return 'VAPID Public- und Private-Key passen nicht zusammen – exakt dasselbe Schlüsselpaar verwenden.'
  }

  const d = status.diagnostics
  if (d && !isDevEnvironment()) {
    const publicOk = d.publicKeyFromProcessEnv || d.publicKeyFromCloudflareEnv
    const privateOk = d.privateKeyFromProcessEnv || d.privateKeyFromCloudflareEnv

    if (!publicOk && !privateOk) {
      return (
        'VAPID-Schlüssel werden vom Worker nicht gelesen. Prüfen: Worker „camping-packliste-app“ ' +
        '(nicht nur Pages), Umgebung Production, danach neu deployen. Diagnose: GET /api/push/subscribe'
      )
    }
    if (publicOk && !privateOk) {
      return 'VAPID_PUBLIC_KEY ist da, VAPID_PRIVATE_KEY fehlt – als Geheimnis am Worker setzen (Typ Geheimnis, JSON-Inhalt als Text).'
    }
    if (!publicOk && privateOk) {
      return (
        'VAPID_PUBLIC_KEY fehlt am Worker. Entweder als Geheimnis setzen: npx wrangler secret put VAPID_PUBLIC_KEY ' +
        '(Klartext-Variablen im Dashboard erscheinen nicht in „wrangler secret list“). ' +
        'Nach dem nächsten Deploy wird der Public Key alternativ aus dem Private Key abgeleitet.'
      )
    }
    if (!d.subjectFromProcessEnv && !d.subjectFromCloudflareEnv) {
      return 'VAPID_SUBJECT fehlt – als Geheimnis setzen: npx wrangler secret put VAPID_SUBJECT (z. B. mailto:deine@email.de).'
    }
  }

  if (isDevEnvironment()) {
    return 'VAPID-Schlüssel fehlen in .dev.vars (pnpm dev neu starten).'
  }

  return 'Push ist auf dem Server noch nicht konfiguriert. VAPID-Schlüssel am Worker prüfen und neu deployen.'
}
