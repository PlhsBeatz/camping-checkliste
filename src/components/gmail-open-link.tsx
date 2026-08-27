'use client'

import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react'
import { buildGmailMobileHref } from '@/lib/gmail-links'
import { cn } from '@/lib/utils'

type Props = {
  webHref: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

/** Gmail-Link – auf dem Smartphone direkt in der Gmail-App öffnen. */
export function GmailOpenLink({ webHref, className, children, onClick }: Props) {
  const [href, setHref] = useState(webHref)

  useEffect(() => {
    setHref(buildGmailMobileHref(webHref))
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
