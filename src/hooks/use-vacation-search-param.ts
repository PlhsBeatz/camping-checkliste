'use client'

import { useSyncExternalStore } from 'react'

function readVacationParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('vacation')
}

function readProfilParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('profil')
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

/** `?profil=uebersicht` – Packliste in der Haushalts-Übersicht öffnen. */
export function usePacklistProfilSearchParam(): string | null {
  return useSyncExternalStore(subscribe, readProfilParam, () => null)
}

/** Nach `router.push('/packliste?vacation=…')` aufrufen, damit die Packliste den Query-Param sieht. */
export function notifyVacationSearchParamChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('packlist-url-query'))
}

/** Einmaliger Hub-Hinweis `?profil=uebersicht` entfernen, damit das Packprofil wieder frei wählbar ist. */
export function clearPacklistOverviewProfilFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('profil')) return
  url.searchParams.delete('profil')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, '', next)
  notifyVacationSearchParamChanged()
}
