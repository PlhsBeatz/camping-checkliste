'use client'

import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react'
import {
  buildGmailMobileHref,
  extractGmailSearchQuery,
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
 */
export function GmailOpenLink({ webHref, className, children, onClick }: Props) {
  const [href, setHref] = useState(webHref)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    setHref(buildGmailMobileHref(webHref))
    setMobile(isMobileGmailUserAgent())
  }, [webHref])

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return

    if (!mobile) return

    // target=_blank in der installierten PWA → interner Browser/Custom Tab.
    // Stattdessen die App per Top-Level-Navigation anstoßen.
    e.preventDefault()

    const ua = navigator.userAgent
    const query = extractGmailSearchQuery(webHref)
    const deepLink = buildGmailMobileHref(webHref, ua)

    if (/iPhone|iPad|iPod/i.test(ua) && query) {
      const started = Date.now()
      window.location.href = deepLink
      window.setTimeout(() => {
        // App nicht installiert / Link nicht verstanden → Web-Gmail.
        if (!document.hidden && Date.now() - started < 2000) {
          window.location.href = webHref
        }
      }, 700)
      return
    }

    window.location.href = deepLink
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
