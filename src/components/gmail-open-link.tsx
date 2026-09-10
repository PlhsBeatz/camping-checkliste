'use client'

import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  buildAndroidGmailLaunchHref,
  buildGmailMobileHref,
  buildIosGmailAppHref,
  copyGmailSearchQuery,
  extractGmailSearchQuery,
  isAndroidUserAgent,
  isAppleMobileUserAgent,
  isMobileGmailUserAgent,
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
 * PWA-internen Browser / Custom Tab), mit korrekter Suchquery.
 *
 * Android: Custom-Scheme-Intent + Suchbegriff in die Zwischenablage
 * (Web-#search fällt in Custom Tabs oft ohne Query auf die Inbox zurück).
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
      // Kein preventDefault: Chrome muss den Intent aus dem echten <a>-Klick starten.
      if (query) {
        void copyGmailSearchQuery(query).then((copied) => {
          if (!copied) return
          toast({
            title: 'Suchbegriff kopiert',
            description:
              'Gmail öffnet sich. Suche dort ggf. einfügen (langer Druck → Einfügen).',
          })
        })
      }

      const started = Date.now()
      window.setTimeout(() => {
        if (document.hidden || Date.now() - started > 2000) return
        // /search evtl. nicht verstanden → App ohne Suche starten
        window.location.href = buildAndroidGmailLaunchHref()
      }, 900)
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
