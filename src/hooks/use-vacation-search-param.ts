'use client'

import { useSyncExternalStore } from 'react'

function readVacationParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('vacation')
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener('packlist-url-query', onStoreChange)
  return () => {
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener('packlist-url-query', onStoreChange)
  }
}

/** `?vacation=` ohne `useSearchParams` – vermeidet Suspense-Remount der ganzen Packliste. */
export function useVacationSearchParam(): string | null {
  return useSyncExternalStore(subscribe, readVacationParam, () => null)
}

/** Nach `router.push('/?vacation=…')` aufrufen, damit die Packliste den Query-Param sieht. */
export function notifyVacationSearchParamChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('packlist-url-query'))
}
