'use client'

import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react'
import { buildGmailOpenHref } from '@/lib/gmail-links'
import { cn } from '@/lib/utils'

type Props = {
  webHref: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

/**
 * Gmail-Link im Browser (am Smartphone: interner Browser / Custom Tab).
 * Mobil über /gmail-suche, damit die Suchquery nicht verloren geht.
 */
export function GmailOpenLink({ webHref, className, children, onClick }: Props) {
  const [href, setHref] = useState(webHref)

  useEffect(() => {
    setHref(buildGmailOpenHref(webHref))
  }, [webHref])

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className)}
      onClick={onClick}
    >
      {children}
    </a>
  )
}
