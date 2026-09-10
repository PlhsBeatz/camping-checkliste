'use client'

import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  buildAndroidGmailLaunchHref,
  buildAndroidGmailMailtoForceHref,
  buildGmailMobileHref,
  buildIosGmailAppHref,
  copyGmailSearchQuery,
  extractGmailSearchQuery,
  isAndroidUserAgent,
  isAppleMobileUserAgent,
  isMobileGmailUserAgent,
  navigateToIntentUrl,
} from '@/lib/gmail-links'
import { cn } from '@/lib/utils'

type Props = {
  webHref: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

/**
 * Gmail-Link – auf dem Smartphone die native Gmail-App öffnen (nicht den
 * PWA-internen Browser / Custom Tab).
 *
 * Android: https-App-Link Intent auf mail.google.com (ohne Web-Fallback) +
 * Suchbegriff in die Zwischenablage. Der Intent kommt vom echten <a>-Klick
 * (Chrome verlangt User-Gesture + BROWSABLE).
 */
export function GmailOpenLink({ webHref, className, children, onClick }: Props) {
  const { toast } = useToast()
  const [href, setHref] = useState(webHref)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    setHref(buildGmailMobileHref(webHref))
    setMobile(isMobileGmailUserAgent())
  }, [webHref])

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return

    const ua = navigator.userAgent
    const query = extractGmailSearchQuery(webHref)

    if (isAndroidUserAgent(ua)) {
      // Kein preventDefault: Chrome startet den Intent nur zuverlässig aus dem
      // echten <a href="intent:…">-Klick (href ist bereits der App-Link).
      if (query) {
        void copyGmailSearchQuery(query).then((copied) => {
          if (!copied) return
          toast({
            title: 'Suchbegriff kopiert',
            description:
              'In Gmail: Suche öffnen und einfügen (langer Druck → Einfügen).',
          })
        })
      }

      const started = Date.now()
      window.setTimeout(() => {
        if (document.hidden || Date.now() - started > 2500) return
        navigateToIntentUrl(buildAndroidGmailLaunchHref())
      }, 800)

      window.setTimeout(() => {
        if (document.hidden || Date.now() - started > 3500) return
        // App-Links deaktiviert → mailto öffnet Gmail trotzdem nativ
        navigateToIntentUrl(buildAndroidGmailMailtoForceHref())
      }, 1600)
      return
    }

    if (isAppleMobileUserAgent(ua) && query) {
      e.preventDefault()
      const started = Date.now()
      window.location.href = buildIosGmailAppHref(query)
      window.setTimeout(() => {
        if (!document.hidden && Date.now() - started < 2000) {
          window.location.href = webHref
        }
      }, 700)
    }
  }

  return (
    <a
      href={href}
      target={mobile ? undefined : '_blank'}
      rel="noopener noreferrer"
      className={cn(className)}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
