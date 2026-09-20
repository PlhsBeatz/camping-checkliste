'use client'

import { useEffect, useState } from 'react'

/** Viewport unter 768px – für Mobile-Dialog vs. Desktop-Popover bei Datepickern. */
export function useIsSmallViewport(breakpointPx = 768): boolean {
  const [isSmall, setIsSmall] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`)
    const set = () => setIsSmall(mql.matches)
    set()
    mql.addEventListener('change', set)
    return () => mql.removeEventListener('change', set)
  }, [breakpointPx])
  return isSmall
}
