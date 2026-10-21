'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ConfigPageLayout,
  SETTINGS_NAV_COLUMN_CLASS,
} from '@/components/config-page-layout'
import { ConfigSubnav } from '@/components/config-subnav'
import { SETTINGS_DEFAULT_HREF } from '@/lib/settings-navigation'
import { cn } from '@/lib/utils'

const DESKTOP_MQ = '(min-width: 1024px)'

export default function EinstellungenPage() {
  const router = useRouter()
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const apply = () => {
      setIsDesktop(mq.matches)
      if (mq.matches) {
        router.replace(SETTINGS_DEFAULT_HREF)
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [router])

  if (isDesktop !== false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <ConfigPageLayout requireConfig={false}>
      <div className={cn(SETTINGS_NAV_COLUMN_CLASS)}>
        <ConfigSubnav />
      </div>
    </ConfigPageLayout>
  )
}
