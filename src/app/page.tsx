'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PackingList } from '@/components/packing-list-enhanced'
import { PackingListGenerator } from '@/components/packing-list-generator'
import { AddSingleItemDialog } from '@/components/add-single-item-dialog'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { PackingSettingsSidebar } from '@/components/packing-settings-sidebar'
import { Plus, Sparkles, Menu, Search, Users } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Vacation, PackingItem, TransportVehicle, Mitreisender, EquipmentItem, Category, MainCategory } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { berechneAnzahl, berechneReiseTage, istKind, regelKurzLabel } from '@/lib/packing-quantity'
import { packingItemsEqual } from '@/lib/packing-items-equal'
import {
  getPackingItemsMemory,
  loadLocalPackingItems,
  setPackingItemsMemory,
  snapshotPackingItemsToMemory,
} from '@/lib/packing-items-memory'
import {
  sortMitreisendeNachRolleUndName,
  sortMitreisendenZeilenNachStammdaten,
} from '@/lib/mitreisenden-sort'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MarkAllConfirmationDialog } from '@/components/mark-all-confirmation-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryGroupedSelectField } from '@/components/category-select-grouped'
import { cn, formatWeight, getInitials } from '@/lib/utils'
import { getMitreisenderAvatarStyle } from '@/lib/user-colors'
import { useAuth } from '@/components/auth-provider'
import { useVacationSearchParam } from '@/hooks/use-vacation-search-param'
import {
  getInitialPacklistUiState,
  readPacklistUiSettings,
  resolveVacationIdForUi,
  writePacklistUiSettings,
} from '@/lib/packlist-ui-settings'
import { usePackingSync } from '@/hooks/use-packing-sync'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import {
  fetchAndCache,
  getCachedPackingItems,
  getCachedVacations,
  getCachedEquipment,
  getCachedCategories,
  getCachedMainCategories,
  getCachedTransportVehicles,
  getCachedVacationMitreisende,
  subscribeToOnlineStatus,
  OUTBOX_SYNCED_EVENT_NAME,
} from '@/lib/offline-sync'
import {
  cachePackingItems,
  cacheVacations,
  cacheEquipment,
  cacheCategories,
  cacheMainCategories,
  cacheTransportVehicles,
  cacheVacationMitreisende,
} from '@/lib/offline-db'

const PACKABLE_STATUSES: readonly string[] = ['Normal', 'Immer gepackt']

/** Nach Reconnect: WS-Refetch kurz unterdrücken (Outbox erzeugt viele packing-list-changed). */
const PACKING_WS_SUPPRESS_MS = 4000
/** Mehrere Refetch-Auslöser (Reconnect, Outbox, WS) zu einem UI-Update bündeln. */
const PACKING_REFRESH_DEBOUNCE_MS = 400
/** Mindestabstand zwischen Post-Reconnect-Refreshes (verhindert doppeltes Laden). */
const POST_RECONNECT_REFRESH_GAP_MS = 2500
/** Nach manuellem Refresh: WS-Events ignorieren (Sync sendet viele packing-list-changed). */
const WS_FETCH_COOLDOWN_MS = 6000

// Helper function to find the next vacation - FIXED
const findNextVacation = (vacations: Vacation[]): Vacation | null => {
  if (vacations.length === 0) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Find vacations that start today or in the future
  const upcomingVacations = vacations.filter(v => {
    const startDate = new Date(v.startdatum)
    startDate.setHours(0, 0, 0, 0)
    return startDate >= today
  })
  
  if (upcomingVacations.length === 0) {
    // No upcoming vacations, return the most recent one
    return vacations.sort((a, b) => 
      new Date(b.startdatum).getTime() - new Date(a.startdatum).getTime()
    )[0] || null
  }
  
  // Return the vacation with the earliest start date (closest to today)
  return upcomingVacations.sort((a, b) => 
    new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
  )[0] || null
}

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

function HomeContent() {
  const { user, canSelectOtherProfiles, canAccessConfig, gepacktRequiresParentApproval, canEditPauschalEntries } = useAuth()
  const { mutate } = useOptimisticMutation()

  const defaultPacklistUi = getInitialPacklistUiState(null)

  // Data state – ohne sessionStorage beim ersten Render (SSR/Hydration-kompatibel)
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const packingItemsRef = useRef(packingItems)
  packingItemsRef.current = packingItems
  /** Einmal Inhalt für diesen Urlaub gehabt – leere Meldung nur dann, nicht während Hintergrund-Sync. */
  const packingHadContentRef = useRef(false)
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Equipment data for FAB modal
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  
  // UI state
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [showPackSettings, setShowPackSettings] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false)
  const [editingPackingItemId, setEditingPackingItemId] = useState<string | null>(null)
  const [editingForMitreisenderId, setEditingForMitreisenderId] = useState<string | null>(null)
  const [_equipmentSearchTerm, _setEquipmentSearchTerm] = useState('')
  const [selectedPackProfile, setSelectedPackProfile] = useState<string | null>(null)
  // Für Admins: merken, für welchen Urlaub das Standard-Packprofil bereits automatisch gesetzt wurde
  const [autoProfileInitializedVacationId, setAutoProfileInitializedVacationId] = useState<string | null>(null)
  const [hidePackedItems, setHidePackedItems] = useState(defaultPacklistUi.hidePackedItems)
  const [activeMainCategory, setActiveMainCategory] = useState(defaultPacklistUi.activeMainCategory)
  const [deletePackingItemConfirm, setDeletePackingItemConfirm] = useState<{
    id: string
    forMitreisenderId?: string | null
    isProfileDelete: boolean
  } | null>(null)
  /** Im Packprofil „Alle“: personenbezogener Eintrag – Auswahl „für wen löschen?“ (wie beim Abhaken) */
  const [deletePersonsConfirm, setDeletePersonsConfirm] = useState<{
    packingItemId: string
    travelers: Array<{ id: string; name: string; gepackt?: boolean; gepackt_vorgemerkt?: boolean }>
  } | null>(null)
  const [listDisplayMode, setListDisplayMode] = useState<'alles' | 'packliste'>(
    defaultPacklistUi.listDisplayMode
  )
  /** Beim Wechsel des Urlaubs: UI aus Storage oder Urlaubs-Standard (einmal pro Urlaub). */
  const lastAppliedDefaultVacationIdRef = useRef<string | null>(null)

  useEffect(() => {
    const vid = resolveVacationIdForUi()
    if (vid) {
      const ui = getInitialPacklistUiState(vid)
      setSelectedVacationId(vid)
      setSelectedPackProfile(ui.selectedPackProfile)
      setHidePackedItems(ui.hidePackedItems)
      setListDisplayMode(ui.listDisplayMode)
      setActiveMainCategory(ui.activeMainCategory)
      if (ui.selectedPackProfile !== null) {
        setAutoProfileInitializedVacationId(vid)
      }
      lastAppliedDefaultVacationIdRef.current = vid
      const mem = getPackingItemsMemory(vid)
      if (mem?.length) {
        setPackingItems(mem)
        packingHadContentRef.current = true
      }
    }
    setStorageHydrated(true)
  }, [])

  const persistPacklistUi = useCallback(
    (patch: Parameters<typeof writePacklistUiSettings>[1]) => {
      if (!selectedVacationId) return
      writePacklistUiSettings(selectedVacationId, patch)
    },
    [selectedVacationId]
  )

  const handleHidePackedChange = useCallback(
    (hide: boolean) => {
      setHidePackedItems(hide)
      persistPacklistUi({ hidePackedItems: hide })
    },
    [persistPacklistUi]
  )

  const handleListDisplayModeChange = useCallback(
    (mode: 'alles' | 'packliste') => {
      setListDisplayMode(mode)
      persistPacklistUi({ listDisplayMode: mode })
    },
    [persistPacklistUi]
  )

  const handlePackProfileChange = useCallback(
    (profileId: string | null) => {
      setSelectedPackProfile(profileId)
      persistPacklistUi({ selectedPackProfile: profileId })
    },
    [persistPacklistUi]
  )

  const handleActiveMainCategoryChange = useCallback(
    (category: string) => {
      setActiveMainCategory(category)
      persistPacklistUi({ activeMainCategory: category })
    },
    [persistPacklistUi]
  )
  const addDialogScrollContextRef = useRef<{ mainCategory: string; category: string } | null>(null)
  const addDialogScrollRef = useRef<HTMLDivElement>(null)
  const [showAddSingleItemDialog, setShowAddSingleItemDialog] = useState(false)
  const [addSingleItemInitialName, setAddSingleItemInitialName] = useState('')
  /** Hauptkategorie-Titel (Packliste) beim Öffnen „Neu“ – für Kategorie-Dropdown-Scroll. */
  const [addSingleItemScrollMain, setAddSingleItemScrollMain] = useState<string | null>(null)

  const handleScrollContextChange = useCallback((ctx: { mainCategory: string; category: string } | null) => {
    addDialogScrollContextRef.current = ctx
  }, [])

  // Sidebar offen: Body-Scroll sperren, damit beim Wischen/Scrollen in der Sidebar die Seite nicht mitscrollt
  useEffect(() => {
    const sidebarOpen = showNavSidebar || showPackSettings
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar, showPackSettings])
  
  // FAB modal state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set())
  
  // Form state
  const [packingItemForm, setPackingItemForm] = useState({
    gegenstandId: '',
    anzahl: '1',
    bemerkung: '',
    transportId: '',
    was: '',
    kategorieId: ''
  })

  const urlVacationId = useVacationSearchParam()

  // Refetch-Tick: bei Reconnect bumpen → Stammdaten- und Urlaubsliste neu laden
  const [refetchTick, setRefetchTick] = useState(0)

  const vacationFetchVersionRef = useRef(0)

  // „Packliste öffnen“ (/?vacation=…): Auswahl sofort setzen, nicht auf API warten
  useEffect(() => {
    if (!urlVacationId) return
    setSelectedVacationId(urlVacationId)
  }, [urlVacationId])

  // Urlaubsliste laden (IndexedDB-Fallback wie bei Packlisten-Einträgen)
  useEffect(() => {
    const myVersion = ++vacationFetchVersionRef.current
    const loadVacations = async () => {
      const { data } = await fetchAndCache<Vacation[]>(
        '/api/vacations',
        cacheVacations,
        getCachedVacations,
        { cache: 'no-store' }
      )
      if (myVersion !== vacationFetchVersionRef.current) return
      if (data !== null) setVacations(data)
    }
    void loadVacations()
  }, [refetchTick])

  // Gewählten Urlaub: URL → bestehende Auswahl beibehalten → sessionStorage → nächster
  useEffect(() => {
    if (vacations.length === 0) return

    if (urlVacationId) {
      if (vacations.some((v) => v.id === urlVacationId)) {
        setSelectedVacationId(urlVacationId)
      }
      return
    }

    // Reconnect/Refetch der Urlaubsliste: aktuellen Urlaub nicht überschreiben
    if (
      selectedVacationId &&
      vacations.some((v) => v.id === selectedVacationId)
    ) {
      return
    }

    const stored =
      typeof window !== 'undefined' ? sessionStorage.getItem('packlistVacationId') : null
    if (stored && vacations.some((v) => v.id === stored)) {
      setSelectedVacationId(stored)
      return
    }

    const nextVacation = findNextVacation(vacations)
    if (nextVacation) setSelectedVacationId(nextVacation.id)
  }, [urlVacationId, vacations, selectedVacationId])

  // Pack-Status nutzt diesen Urlaub; bei Wechsel sync zu sessionStorage
  useEffect(() => {
    if (selectedVacationId && typeof window !== 'undefined') {
      sessionStorage.setItem('packlistVacationId', selectedVacationId)
    }
  }, [selectedVacationId])

  // Versionszähler: veraltete Fetch-Antworten ignorieren (verhindert Race bei schnellem Abhaken)
  const fetchPackingVersionRef = useRef(0)
  const packingRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const packingRefreshInFlightRef = useRef<Promise<void> | null>(null)
  const wsRefreshSuppressUntilRef = useRef(0)
  const postReconnectRefreshUntilRef = useRef(0)
  const lastPackingFetchAtRef = useRef(0)

  // Zähler ausstehender eigener Mutationen: Refetch nur wenn 0 (Änderung von anderem Gerät
  // oder alle eigenen PUTs abgeschlossen – verhindert partielle Daten bei schnellem Abhaken)
  const pendingMutationsRef = useRef(0)

  const applyPackingItemsFromFetch = useCallback(
    (next: PackingItem[]) => {
      if (!selectedVacationId) return
      setPackingItems((prev) => {
        if (next.length === 0 && prev.length > 0) return prev
        if (packingItemsEqual(prev, next)) return prev
        if (next.length > 0) {
          packingHadContentRef.current = true
          setPackingItemsMemory(selectedVacationId, next)
          lastPackingFetchAtRef.current = Date.now()
        }
        return next
      })
    },
    [selectedVacationId]
  )

  /** Beim Offline-Wechsel: sichtbare Liste sofort in Memory/IDB sichern, bevor async Fetches enden.
   *  Kein `setPackingItems` – die UI zeigt die Liste bereits, ein erneutes Setzen ist überflüssig. */
  const preservePackingSnapshot = useCallback((vacationId: string): boolean => {
    const current = packingItemsRef.current
    if (current.length === 0) return false
    packingHadContentRef.current = true
    snapshotPackingItemsToMemory(vacationId, current)
    void cachePackingItems(vacationId, current)
    return true
  }, [])

  const restorePackingFromLocal = useCallback(
    async (vacationId: string, version: number) => {
      if (preservePackingSnapshot(vacationId)) return
      const local = await loadLocalPackingItems(vacationId)
      if (version !== fetchPackingVersionRef.current) return
      if (local) applyPackingItemsFromFetch(local)
    },
    [applyPackingItemsFromFetch, preservePackingSnapshot]
  )

  // Fetch Packing Items: offline nur lokal; online mit Cache-Fallback; nie [] über bestehende Liste
  const fetchPackingItemsNow = useCallback(async () => {
    if (!selectedVacationId) return
    const vacationId = selectedVacationId
    const myVersion = ++fetchPackingVersionRef.current

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await restorePackingFromLocal(vacationId, myVersion)
      return
    }

    const { data } = await fetchAndCache<PackingItem[]>(
      `/api/packing-items?vacationId=${vacationId}`,
      (items) =>
        items.length > 0
          ? cachePackingItems(vacationId, items)
          : Promise.resolve(),
      () => getCachedPackingItems(vacationId),
      { cache: 'no-store' }
    )
    if (myVersion !== fetchPackingVersionRef.current) return

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await restorePackingFromLocal(vacationId, myVersion)
      return
    }

    if (data !== null && data.length > 0) {
      applyPackingItemsFromFetch(data)
      return
    }

    await restorePackingFromLocal(vacationId, myVersion)
  }, [selectedVacationId, applyPackingItemsFromFetch, restorePackingFromLocal])

  const runPackingRefresh = useCallback(async () => {
    if (packingRefreshInFlightRef.current) {
      return packingRefreshInFlightRef.current
    }
    const run = fetchPackingItemsNow()
    packingRefreshInFlightRef.current = run
    void run.finally(() => {
      if (packingRefreshInFlightRef.current === run) {
        packingRefreshInFlightRef.current = null
      }
    })
    return run
  }, [fetchPackingItemsNow])

  const schedulePackingRefresh = useCallback(
    (delayMs = PACKING_REFRESH_DEBOUNCE_MS) => {
      if (packingRefreshDebounceRef.current) {
        clearTimeout(packingRefreshDebounceRef.current)
      }
      packingRefreshDebounceRef.current = setTimeout(() => {
        packingRefreshDebounceRef.current = null
        void runPackingRefresh()
      }, delayMs)
    },
    [runPackingRefresh]
  )

  /** Nach Reconnect/Outbox höchstens ein gebündelter Packlisten-Refresh. */
  const schedulePostReconnectRefresh = useCallback(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const now = Date.now()
    if (now < postReconnectRefreshUntilRef.current) return
    postReconnectRefreshUntilRef.current = now + POST_RECONNECT_REFRESH_GAP_MS
    wsRefreshSuppressUntilRef.current = now + WS_FETCH_COOLDOWN_MS
    schedulePackingRefresh(PACKING_REFRESH_DEBOUNCE_MS)
  }, [schedulePackingRefresh])

  useEffect(() => {
    return () => {
      if (packingRefreshDebounceRef.current) {
        clearTimeout(packingRefreshDebounceRef.current)
      }
    }
  }, [])

  // Optimistische Änderungen: Memory + IndexedDB (Remount & Offline)
  useEffect(() => {
    if (!selectedVacationId) return
    if (packingItems.length > 0) {
      packingHadContentRef.current = true
      setPackingItemsMemory(selectedVacationId, packingItems)
      void cachePackingItems(selectedVacationId, packingItems)
    }
  }, [selectedVacationId, packingItems])

  useEffect(() => {
    if (!selectedVacationId) return
    const mem = getPackingItemsMemory(selectedVacationId)
    packingHadContentRef.current = (mem?.length ?? 0) > 0
  }, [selectedVacationId])

  const fetchPackingItemsNowRef = useRef(fetchPackingItemsNow)
  fetchPackingItemsNowRef.current = fetchPackingItemsNow

  useEffect(() => {
    if (!selectedVacationId) return
    void fetchPackingItemsNowRef.current()
  }, [selectedVacationId])

  // WebSocket für Echtzeit-Sync: gebündelt; nach Reconnect/Refresh kurz pausieren
  const handlePackingSyncUpdate = useCallback(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (Date.now() < wsRefreshSuppressUntilRef.current) return
    if (Date.now() - lastPackingFetchAtRef.current < WS_FETCH_COOLDOWN_MS) return
    if (pendingMutationsRef.current > 0) return
    schedulePackingRefresh()
  }, [schedulePackingRefresh])
  usePackingSync(selectedVacationId, handlePackingSyncUpdate)

  // Bei Reconnect: Sync über OfflineBanner; hier nur gebündelter Daten-Refresh (kein doppeltes processSyncQueue)
  useEffect(() => {
    let initial = true
    let lastOnline =
      typeof navigator !== 'undefined' ? navigator.onLine : true
    return subscribeToOnlineStatus((online) => {
      if (initial) {
        initial = false
        lastOnline = online
        return
      }
      if (!online && lastOnline) {
        fetchPackingVersionRef.current += 1
        if (packingRefreshDebounceRef.current) {
          clearTimeout(packingRefreshDebounceRef.current)
          packingRefreshDebounceRef.current = null
        }
        packingRefreshInFlightRef.current = null
        if (selectedVacationId) {
          void restorePackingFromLocal(
            selectedVacationId,
            fetchPackingVersionRef.current
          )
        }
      }
      if (online && !lastOnline) {
        // Kein Refetch beim reinen Online-Wechsel: Das löst sonst einen sichtbaren
        // Neuaufbau aus, obwohl sich nichts geändert hat.
        // - Ausstehende eigene Änderungen → Refresh kommt nach dem Sync über OUTBOX_SYNCED.
        // - Änderungen anderer Geräte → liefert der WebSocket (packing-list-changed).
        wsRefreshSuppressUntilRef.current = Date.now() + WS_FETCH_COOLDOWN_MS
      }
      lastOnline = online
    })
  }, [selectedVacationId, restorePackingFromLocal])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOutboxSynced = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      wsRefreshSuppressUntilRef.current = Date.now() + WS_FETCH_COOLDOWN_MS
      schedulePostReconnectRefresh()
    }
    window.addEventListener(OUTBOX_SYNCED_EVENT_NAME, onOutboxSynced)
    return () => window.removeEventListener(OUTBOX_SYNCED_EVENT_NAME, onOutboxSynced)
  }, [schedulePostReconnectRefresh])

  // Fetch Mitreisende for vacation (mit Offline-Cache pro Urlaub)
  useEffect(() => {
    if (!selectedVacationId) return

    const fetchVacationMitreisende = async () => {
      const { data } = await fetchAndCache<Mitreisender[]>(
        `/api/mitreisende?vacationId=${selectedVacationId}`,
        (items) => cacheVacationMitreisende(selectedVacationId, items),
        () => getCachedVacationMitreisende(selectedVacationId),
        { cache: 'no-store' }
      )
      if (data !== null) {
        setVacationMitreisende(data)
      }
    }
    fetchVacationMitreisende()
  }, [selectedVacationId])

  // Standard-Packprofil je nach Rolle setzen:
  // - Kind/Gast: immer eigenes Profil
  // - Admin: pro Urlaub genau einmal automatisch eigenes Profil wählen; danach manuelle Auswahl respektieren
  useEffect(() => {
    if (!user?.mitreisender_id || vacationMitreisende.length === 0) return
    const ownId = user.mitreisender_id
    const isOnVacation = vacationMitreisende.some((m) => m.id === ownId)
    if (!isOnVacation) return

    if (!canSelectOtherProfiles) {
      // Kind/Gast: immer eigenes Profil, kein „Alle“-Profil
      if (selectedPackProfile !== ownId) {
        handlePackProfileChange(ownId)
      }
      return
    }

    // Ab hier: Admin-Logik
    if (!selectedVacationId) return

    // Wenn für diesen Urlaub bereits automatisch ein Profil gesetzt wurde, nichts mehr überschreiben
    if (autoProfileInitializedVacationId === selectedVacationId) return

    // Admin: nur beim ersten Laden dieses Urlaubs automatisch eigenes Profil setzen,
    // und nur, wenn aktuell noch kein Profil gewählt wurde (z.B. durch Session/URL)
    if (selectedPackProfile === null) {
      handlePackProfileChange(ownId)
    }
    setAutoProfileInitializedVacationId(selectedVacationId)
  }, [
    canSelectOtherProfiles,
    user?.mitreisender_id,
    vacationMitreisende,
    selectedPackProfile,
    user,
    selectedVacationId,
    autoProfileInitializedVacationId,
    handlePackProfileChange,
  ])

  // Fetch Equipment Items for FAB modal
  useEffect(() => {
    const fetchEquipmentItems = async () => {
      try {
        const res = await fetch('/api/equipment-items')
        const data = (await res.json()) as ApiResponse<EquipmentItem[]>
        if (data.success && data.data) {
          setEquipmentItems(data.data)
          await cacheEquipment(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equipment items:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedEquipment()
          if (cached.length > 0) setEquipmentItems(cached)
        }
      }
    }
    fetchEquipmentItems()
  }, [refetchTick])

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = (await res.json()) as ApiResponse<CategoryWithMain[]>
        if (data.success && data.data) {
          setCategories(data.data)
          await cacheCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedCategories()
          if (cached.length > 0) setCategories(cached as CategoryWithMain[])
        }
      }
    }
    fetchCategories()
  }, [refetchTick])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = (await res.json()) as ApiResponse<MainCategory[]>
        if (data.success && data.data) {
          setMainCategories(data.data)
          await cacheMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMainCategories()
          if (cached.length > 0) setMainCategories(cached)
        }
      }
    }
    fetchMainCategories()
  }, [refetchTick])

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransportVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setTransportVehicles(data.data)
          await cacheTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedTransportVehicles()
          if (cached.length > 0) setTransportVehicles(cached)
        }
      }
    }
    fetchTransportVehicles()
  }, [refetchTick])

  // Get available equipment (not on packing list, or on list but without selected person)
  const availableEquipment = useMemo(() => {
    const vacationMitreisendeIds = vacationMitreisende.map((m) => m.id)
    const vacationMitreisendeSet = new Set(vacationMitreisendeIds)

    return equipmentItems.filter((eq) => {
      if (!PACKABLE_STATUSES.includes(eq.status)) return false
      // Ohne Berechtigung für pauschale Einträge: diese nicht zur Auswahl anbieten
      if (!canEditPauschalEntries && (eq.mitreisenden_typ ?? 'pauschal') === 'pauschal') return false
      const existingItem = packingItems.find((p) => p.gegenstand_id === eq.id)
      if (!existingItem) return true // Nicht auf der Liste → verfügbar

      if (selectedPackProfile) {
        // Packprofil einer Person: Pauschal bereits auf Liste → nicht verfügbar; alle/ausgewaehlte wenn Person fehlt
        if (existingItem.mitreisenden_typ === 'pauschal') return false
        return !existingItem.mitreisende?.some((m) => m.mitreisender_id === selectedPackProfile)
      }

      // Packprofil „Alle“: Pauschal bereits auf Liste → nicht verfügbar
      if (existingItem.mitreisenden_typ === 'pauschal') return false
      // Typ „alle“: verfügbar, wenn nicht alle Urlaubs-Mitreisenden dem Eintrag zugeordnet sind
      const existingIds = new Set((existingItem.mitreisende ?? []).map((m) => m.mitreisender_id))
      if ((eq.mitreisenden_typ ?? 'pauschal') === 'alle') {
        const allAssigned = vacationMitreisendeIds.every((id) => existingIds.has(id))
        return !allAssigned
      }
      // Typ „ausgewaehlte“: verfügbar, wenn nicht alle standardmäßig zugeordneten (die im Urlaub sind) zugeordnet sind
      const expectedIds = (eq.standard_mitreisende ?? []).filter((id) => vacationMitreisendeSet.has(id))
      if (expectedIds.length === 0) return false // Keine erwarteten Personen im Urlaub → nicht anbieten
      const allAssigned = expectedIds.every((id) => existingIds.has(id))
      return !allAssigned
    })
  }, [equipmentItems, packingItems, selectedPackProfile, canEditPauschalEntries, vacationMitreisende])

  // Filter and group available equipment (nur Kategorien mit verfügbaren Gegenständen)
  const groupedAvailableEquipment = useMemo(() => {
    const filtered = availableEquipment.filter(item => {
      if (!searchTerm) return true
      return item.was.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const mainCategoryGroups: Record<string, Record<string, EquipmentItem[]>> = {}
    filtered.forEach(item => {
      const category = categories.find(c => c.id === item.kategorie_id)
      if (!category) return
      const mainCategory = mainCategories.find(mc => mc.id === category.hauptkategorie_id)
      if (!mainCategory) return
      const mainCategoryName = mainCategory.titel
      const categoryName = category.titel
      if (!mainCategoryGroups[mainCategoryName]) mainCategoryGroups[mainCategoryName] = {}
      if (!mainCategoryGroups[mainCategoryName][categoryName]) mainCategoryGroups[mainCategoryName][categoryName] = []
      mainCategoryGroups[mainCategoryName][categoryName].push(item)
    })

    return mainCategories
      .filter(mc => mainCategoryGroups[mc.titel])
      .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
      .map(mc => {
        const mainCatGroup = mainCategoryGroups[mc.titel]!
        return {
          id: mc.id,
          name: mc.titel,
          order: mc.reihenfolge || 0,
          categories: categories
            .filter(c => c.hauptkategorie_id === mc.id && mainCatGroup[c.titel])
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
            .map(c => ({
              id: c.id,
              name: c.titel,
              items: mainCatGroup[c.titel]!
            }))
        }
      })
  }, [availableEquipment, searchTerm, categories, mainCategories])

  const currentVacation = useMemo((): Vacation | null => {
    if (!selectedVacationId) return null
    const found = vacations.find((v) => v.id === selectedVacationId)
    if (found) return found
    // Metadaten noch nicht aus Cache – Packliste trotzdem anzeigen (z. B. direkt nach ?vacation=)
    const today = new Date().toISOString().slice(0, 10)
    return {
      id: selectedVacationId,
      titel: 'Packliste',
      startdatum: today,
      enddatum: today,
      reiseziel_name: '',
      created_at: today,
      packliste_default_ansicht: 'packliste',
    }
  }, [selectedVacationId, vacations])

  // Beim Wechsel des Urlaubs: gespeicherte UI laden (nur wenn Urlaub wechselt – nicht bei Reconnect-Refetch)
  useEffect(() => {
    if (!selectedVacationId) return
    if (lastAppliedDefaultVacationIdRef.current === selectedVacationId) return
    lastAppliedDefaultVacationIdRef.current = selectedVacationId

    const saved = readPacklistUiSettings(selectedVacationId)
    if (saved?.hidePackedItems !== undefined) {
      setHidePackedItems(saved.hidePackedItems)
    }
    if (saved?.listDisplayMode) {
      setListDisplayMode(saved.listDisplayMode)
    } else if (vacations.length > 0) {
      const vacation = vacations.find((v) => v.id === selectedVacationId)
      const defaultMode =
        vacation?.packliste_default_ansicht === 'alles' ? 'alles' : 'packliste'
      setListDisplayMode(defaultMode)
    }
    if (saved?.selectedPackProfile !== undefined) {
      setSelectedPackProfile(saved.selectedPackProfile)
      if (saved.selectedPackProfile !== null) {
        setAutoProfileInitializedVacationId(selectedVacationId)
      }
    }
    setActiveMainCategory(saved?.activeMainCategory ?? '')
  }, [selectedVacationId, vacations])

  const handleGeneratePackingList = async (equipmentItems: EquipmentItem[]) => {
    if (!selectedVacationId || equipmentItems.length === 0) return
    pendingMutationsRef.current += 1

    const packlisteGegenstandIds = new Set(packingItems.map(p => p.gegenstand_id))
    const toAdd = equipmentItems.filter(eq => !packlisteGegenstandIds.has(eq.id))

    if (toAdd.length === 0) {
      pendingMutationsRef.current -= 1
      alert('Alle ausgewählten Gegenstände sind bereits in der Packliste.')
      return
    }

    const vacationMitreisendeIds = vacationMitreisende.map(m => m.id)
    const vacationMitreisendeSet = new Set(vacationMitreisendeIds)
    const vacationMitreisendeById = new Map(vacationMitreisende.map(m => [m.id, m]))
    const reiseTage = currentVacation ? berechneReiseTage(currentVacation) : 1

    try {
      const items = toAdd.map((item) => {
        const typ = (item.mitreisenden_typ ?? 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte'
        let mitreisendeIds: string[] = []
        if (typ === 'alle') {
          mitreisendeIds = vacationMitreisendeIds
        } else if (typ === 'ausgewaehlte') {
          // Nur Mitreisende zuordnen, die auch beim Urlaub dabei sind
          const filtered = (item.standard_mitreisende ?? []).filter(id => vacationMitreisendeSet.has(id))
          // Fallback: Wenn keine Überlappung (z.B. andere Urlaubsgruppe) → alle Urlaubs-Mitreisenden
          mitreisendeIds = filtered.length > 0 ? filtered : vacationMitreisendeIds
        }

        // Mengenregel auswerten:
        //  - pauschal: Regel einmal für Erwachsenen-Fall berechnen, sonst standard_anzahl.
        //  - alle/ausgewaehlte: Pro Person (Kind/Erwachsener) einzeln rechnen.
        //    Zeilen-anzahl = Summe, Pro-Person-Anzahl wandert in die Junction.
        if (item.mengenregel && typ !== 'pauschal' && mitreisendeIds.length > 0) {
          const mitreisendeMitAnzahl = mitreisendeIds.map((id) => {
            const person = vacationMitreisendeById.get(id)
            const anzahl = berechneAnzahl(
              item.mengenregel,
              reiseTage,
              person ? istKind(person) : false,
            )
            return { id, anzahl }
          })
          // pe.anzahl ist hier der Pro-Person-Default (Erwachsenen-Wert); die
          // tatsächlichen Pro-Person-Werte stehen in mitreisende[].anzahl.
          // So bleibt der Eintrag in der „Alle"-Sicht ohne irreführende Summe
          // und der Wert dient als Fallback für Weight-Queries.
          const erwachsenenWert = berechneAnzahl(item.mengenregel, reiseTage, false)
          return {
            gegenstandId: item.id,
            anzahl: Math.max(erwachsenenWert, 1),
            transportId: item.transport_id || null,
            mitreisende: mitreisendeMitAnzahl,
          }
        }

        const anzahl = item.mengenregel
          ? berechneAnzahl(item.mengenregel, reiseTage, false)
          : item.standard_anzahl ?? 1
        return {
          gegenstandId: item.id,
          anzahl: Math.max(anzahl, 0),
          transportId: item.transport_id || null,
          mitreisende: mitreisendeIds,
        }
      })

      const res = await fetch('/api/packing-items/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacationId: selectedVacationId, items }),
      })
      const batchData = (await res.json()) as ApiResponse<{ added: number; total: number }>
      if (!res.ok || !batchData.success) {
        throw new Error(batchData.error ?? 'Batch-Anfrage fehlgeschlagen')
      }

      const refreshRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
        cache: 'no-store',
      })
      const data = (await refreshRes.json()) as ApiResponse<PackingItem[]>
      if (data.success && data.data && data.data.length > 0) {
        applyPackingItemsFromFetch(data.data)
      }
    } catch (error) {
      console.error('Failed to generate packing list:', error)
      throw error
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleSetPacked = async (itemId: string, gepackt: boolean) => {
    pendingMutationsRef.current += 1
    const prevItems = packingItems
    // Optimistic update: bei Kind mit vorgemerkt → gepackt_vorgemerkt setzen; bei Admin Abhaken/Vormerkung entfernen
    setPackingItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? gepacktRequiresParentApproval
            ? { ...item, gepackt_vorgemerkt: gepackt, gepackt_vorgemerkt_durch: gepackt ? user?.mitreisender_id ?? undefined : undefined }
            : { ...item, gepackt, ...(gepackt === false && { gepackt_vorgemerkt: false, gepackt_vorgemerkt_durch: undefined }) }
          : item
      )
    )
    try {
      const result = await mutate({
        table: 'packing-items',
        action: 'put',
        key: itemId,
        payload: { gepackt },
      })
      if (!result.ok && !result.queued) {
        setPackingItems(prevItems)
        alert(result.error ?? 'Fehler beim Aktualisieren')
      }
    } catch (error) {
      console.error('Failed to set packed:', error)
      setPackingItems(prevItems)
      alert('Fehler beim Aktualisieren')
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleTogglePacked = async (itemId: string) => {
    pendingMutationsRef.current += 1
    const item = packingItems.find(p => p.id === itemId)
    // Kind: effectivePacked (gepackt oder vorgemerkt) für korrekten Toggle – Vormerkung entfernen möglich
    const isPacked = item
      ? (gepacktRequiresParentApproval ? !!(item.gepackt || item.gepackt_vorgemerkt) : !!item.gepackt)
      : false
    const newPackedState = !isPacked
    const prevItems = packingItems

    // Optimistic update: bei Kind mit vorgemerkt → gepackt_vorgemerkt
    setPackingItems(prev =>
      prev.map(p =>
        p.id === itemId
          ? gepacktRequiresParentApproval
            ? { ...p, gepackt_vorgemerkt: newPackedState, gepackt_vorgemerkt_durch: newPackedState ? user?.mitreisender_id ?? undefined : undefined }
            : { ...p, gepackt: newPackedState }
          : p
      )
    )

    try {
      // Outbox: bei Offline / 5xx wird der Eintrag in syncQueue gelegt und beim Reconnect
      // automatisch nachgeschickt. UI bleibt optimistisch.
      const result = await mutate({
        table: 'packing-items',
        action: 'put',
        key: itemId,
        payload: { gepackt: newPackedState },
      })
      if (!result.ok && !result.queued) {
        setPackingItems(prevItems)
        alert(result.error ?? 'Fehler beim Aktualisieren')
      }
    } catch (error) {
      console.error('Failed to toggle packed:', error)
      setPackingItems(prevItems)
      alert('Fehler beim Aktualisieren')
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleToggleMitreisender = async (itemId: string, mitreisenderId: string, currentStatus: boolean) => {
    pendingMutationsRef.current += 1
    const newStatus = !currentStatus
    const prevItems = packingItems

    // Optimistic update: bei Kind mit vorgemerkt → gepackt_vorgemerkt, sonst gepackt (+ Vormerkung zurücksetzen)
    const updateField = gepacktRequiresParentApproval
      ? (m: { mitreisender_id: string; mitreisender_name: string; gepackt: boolean; gepackt_vorgemerkt?: boolean; anzahl?: number }) =>
          ({ ...m, gepackt_vorgemerkt: newStatus } as typeof m)
      : (m: { mitreisender_id: string; mitreisender_name: string; gepackt: boolean; gepackt_vorgemerkt?: boolean; anzahl?: number }) =>
          ({ ...m, gepackt: newStatus, ...(newStatus === false && { gepackt_vorgemerkt: false }) } as typeof m)
    const newMitEntry = gepacktRequiresParentApproval
      ? { mitreisender_id: mitreisenderId, mitreisender_name: vacationMitreisende.find(m => m.id === mitreisenderId)?.name ?? '', gepackt: false, gepackt_vorgemerkt: true }
      : { mitreisender_id: mitreisenderId, mitreisender_name: vacationMitreisende.find(m => m.id === mitreisenderId)?.name ?? '', gepackt: true }

    setPackingItems(prev =>
      prev.map(p => {
        if (p.id !== itemId) return p
        const mitreisende = p.mitreisende ?? []
        const existingIdx = mitreisende.findIndex(m => m.mitreisender_id === mitreisenderId)
        let updatedMitreisende: typeof mitreisende
        if (existingIdx >= 0) {
          updatedMitreisende = mitreisende.map((m, i) =>
            i === existingIdx ? updateField(m) : m
          )
        } else if (newStatus) {
          updatedMitreisende = [...mitreisende, newMitEntry]
        } else {
          return p
        }
        return { ...p, mitreisende: updatedMitreisende }
      })
    )

    try {
      const result = await mutate({
        table: 'packing-items-toggle-mitreisender',
        action: 'put',
        key: `${itemId}|${mitreisenderId}`,
        payload: {
          packingItemId: itemId,
          mitreisenderId,
          gepackt: newStatus,
        },
      })
      if (!result.ok && !result.queued) {
        setPackingItems(prevItems)
      }
    } catch (error) {
      console.error('Failed to toggle mitreisender:', error)
      setPackingItems(prevItems)
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleToggleMultipleMitreisende = async (packingItemId: string, updates: Array<{ mitreisenderId: string; newStatus: boolean }>) => {
    pendingMutationsRef.current += 1
    const prevItems = packingItems

    const newEntry = (id: string, name: string, status: boolean) =>
      gepacktRequiresParentApproval
        ? { mitreisender_id: id, mitreisender_name: name, gepackt: false, gepackt_vorgemerkt: status }
        : { mitreisender_id: id, mitreisender_name: name, gepackt: status }

    setPackingItems(prev =>
      prev.map(p => {
        if (p.id !== packingItemId) return p
        const mitreisende = [...(p.mitreisende ?? [])]
        const updateMap = new Map(updates.map(u => [u.mitreisenderId, u.newStatus]))
        const updated = mitreisende.map(m => {
          const newStatus = updateMap.get(m.mitreisender_id)
          if (newStatus === undefined) return m
          return gepacktRequiresParentApproval ? { ...m, gepackt_vorgemerkt: newStatus } : { ...m, gepackt: newStatus }
        })
        updates.forEach(u => {
          if (!updated.some(m => m.mitreisender_id === u.mitreisenderId) && u.newStatus) {
            const name = vacationMitreisende.find(m => m.id === u.mitreisenderId)?.name ?? ''
            updated.push(newEntry(u.mitreisenderId, name, u.newStatus))
          }
        })
        return { ...p, mitreisende: updated }
      })
    )

    try {
      for (const update of updates) {
        const res = await fetch('/api/packing-items/toggle-mitreisender', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packingItemId,
            mitreisenderId: update.mitreisenderId,
            gepackt: update.newStatus
          }),
        })
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          setPackingItems(prevItems)
          return
        }
      }
    } catch (error) {
      console.error('Failed to toggle multiple mitreisende:', error)
      setPackingItems(prevItems)
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleRemoveVorgemerkt = (packingItemId: string, mitreisenderId?: string) => {
    if (mitreisenderId) {
      handleToggleMitreisender(packingItemId, mitreisenderId, true)
    } else {
      handleSetPacked(packingItemId, false)
    }
  }

  const handleConfirmVorgemerkt = async (packingItemId: string, mitreisenderId?: string) => {
    pendingMutationsRef.current += 1
    const prevItems = packingItems
    setPackingItems(prev =>
      prev.map(p => {
        if (p.id !== packingItemId) return p
        if (mitreisenderId) {
          const mitreisende = (p.mitreisende ?? []).map(m =>
            m.mitreisender_id === mitreisenderId ? { ...m, gepackt: true, gepackt_vorgemerkt: false } : m
          )
          return { ...p, mitreisende }
        }
        return { ...p, gepackt: true, gepackt_vorgemerkt: false, gepackt_vorgemerkt_durch: undefined }
      })
    )
    try {
      const res = await fetch('/api/packing-items/confirm-vorgemerkt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packingItemId, mitreisenderId }),
      })
      const data = (await res.json()) as ApiResponse<boolean>
      if (!data.success) {
        setPackingItems(prevItems)
        alert('Fehler beim Bestätigen')
      }
    } catch (error) {
      console.error('Failed to confirm vorgemerkt:', error)
      setPackingItems(prevItems)
      alert('Fehler beim Bestätigen')
    } finally {
      pendingMutationsRef.current -= 1
    }
  }

  const handleEditPackingItem = (item: PackingItem) => {
    setEditingPackingItemId(item.id)
    const personEntry = selectedPackProfile
      ? item.mitreisende?.find((m) => m.mitreisender_id === selectedPackProfile)
      : null
    const forProfile =
      selectedPackProfile &&
      item.mitreisenden_typ !== 'pauschal' &&
      (personEntry || item.mitreisende?.some((m) => m.mitreisender_id === selectedPackProfile))
    setEditingForMitreisenderId(forProfile ? selectedPackProfile : null)
    const anzahl =
      selectedPackProfile && personEntry?.anzahl != null ? personEntry.anzahl : item.anzahl
    const transportForForm = selectedPackProfile && personEntry?.transport_id !== undefined && personEntry?.transport_id !== null
      ? (personEntry.transport_id ?? '')
      : (item.transport_id || '')
    setPackingItemForm({
      gegenstandId: item.gegenstand_id,
      anzahl: String(anzahl ?? item.anzahl),
      bemerkung: item.bemerkung || '',
      transportId: transportForForm,
      was: item.is_temporaer ? item.was : '',
      kategorieId: item.is_temporaer && item.kategorie_id ? item.kategorie_id : ''
    })
    setShowEditItemDialog(true)
  }

  const handleUpdatePackingItem = async () => {
    if (!editingPackingItemId) return
    pendingMutationsRef.current += 1

    const item = packingItems.find((p) => p.id === editingPackingItemId)
    const isProfileUpdate = !!editingForMitreisenderId && !!item

    setIsLoading(true)
    try {
      if (isProfileUpdate) {
        const res = await fetch('/api/packing-items/set-mitreisender-anzahl', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packingItemId: editingPackingItemId,
            mitreisenderId: editingForMitreisenderId,
            anzahl: parseInt(packingItemForm.anzahl) || 1,
            transportId: packingItemForm.transportId || null,
          }),
        })
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          alert('Fehler beim Aktualisieren: ' + (data.error ?? 'Unbekannt'))
          return
        }
        if (item.is_temporaer) {
          const newWas = packingItemForm.was.trim()
          if (!newWas) {
            alert('Bitte eine Bezeichnung eingeben.')
            return
          }
          const kid = packingItemForm.kategorieId.trim()
          if (!kid) {
            alert('Bitte eine Kategorie wählen.')
            return
          }
          const resWas = await fetch('/api/packing-items', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editingPackingItemId,
              was: newWas,
              kategorieId: kid,
            }),
          })
          const dataWas = (await resWas.json()) as ApiResponse<boolean>
          if (!dataWas.success) {
            alert('Fehler beim Aktualisieren der Bezeichnung: ' + (dataWas.error ?? 'Unbekannt'))
            return
          }
        }
      } else {
        const editPayload: Record<string, unknown> = {
          id: editingPackingItemId,
          anzahl: parseInt(packingItemForm.anzahl) || 1,
          bemerkung: packingItemForm.bemerkung || null,
          transport_id: packingItemForm.transportId || null,
        }
        if (item?.is_temporaer) {
          const newWas = packingItemForm.was.trim()
          if (!newWas) {
            alert('Bitte eine Bezeichnung eingeben.')
            return
          }
          const kid = packingItemForm.kategorieId.trim()
          if (!kid) {
            alert('Bitte eine Kategorie wählen.')
            return
          }
          editPayload.was = newWas
          editPayload.kategorieId = kid
        }
        const res = await fetch('/api/packing-items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editPayload),
        })
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          alert('Fehler beim Aktualisieren: ' + data.error)
          return
        }
      }

      if (selectedVacationId) {
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
          cache: 'no-store',
        })
        const itemsData = (await itemsRes.json()) as ApiResponse<PackingItem[]>
        if (itemsData.success && itemsData.data && itemsData.data.length > 0) {
          applyPackingItemsFromFetch(itemsData.data)
        }
        setShowEditItemDialog(false)
        setEditingPackingItemId(null)
        setEditingForMitreisenderId(null)
      }
    } catch (error) {
      console.error('Failed to update packing item:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      pendingMutationsRef.current -= 1
      setIsLoading(false)
    }
  }

  const handleDeletePackingItem = (id: string, forMitreisenderId?: string | null) => {
    const item = packingItems.find((p) => p.id === id)
    if (!item) {
      setDeletePackingItemConfirm({ id, forMitreisenderId: null, isProfileDelete: false })
      return
    }

    // Temporär-ähnlich: echte temporäre Einträge oder solche ohne Equipment-Referenz
    const isTempLike = !!item.is_temporaer || !item.gegenstand_id

    const isPauschal = item.mitreisenden_typ === 'pauschal'

    // Pauschale Einträge dürfen im Personenprofil nur dann nicht entfernt werden,
    // wenn der Benutzer keine Berechtigung für pauschale Einträge hat.
    // Ausnahme: temporäre/„temp-like“ Einträge, die aus jedem Profil löschbar sein sollen.
    if (forMitreisenderId && isPauschal && !isTempLike && !canEditPauschalEntries) {
      alert('Pauschale Einträge können nur im Packprofil „Alle" entfernt werden.')
      return
    }

    // Packprofil „Alle“: personenbezogener Eintrag (alle/ausgewaehlte) → Dialog „Für wen löschen?“
    const personenbezogen = !forMitreisenderId && !isPauschal && (item.mitreisende?.length ?? 0) > 0
    if (personenbezogen) {
      setDeletePersonsConfirm({
        packingItemId: id,
        travelers: sortMitreisendenZeilenNachStammdaten(
          (item.mitreisende ?? []).map((m) => ({
            id: m.mitreisender_id,
            name: m.mitreisender_name,
            gepackt: !!m.gepackt,
            gepackt_vorgemerkt: !!m.gepackt_vorgemerkt,
          })),
          vacationMitreisende
        ),
      })
      return
    }

    const isTemporaerPauschal = isTempLike && isPauschal
    // Temporär + pauschal: immer Gesamteintrag löschen (nicht nur ein Mitreisender),
    // daher hier kein Profil-Deletepfad.
    // Nicht-temporäre pauschale Einträge: bei Berechtigung auch aus dem Personenprofil heraus
    // immer als Gesamteintrag löschen (kein Profil-Deletepfad).
    const isProfileDelete =
      !!forMitreisenderId &&
      !isTemporaerPauschal &&
      !(isPauschal && !isTempLike)
    setDeletePackingItemConfirm({
      id,
      forMitreisenderId: isProfileDelete ? forMitreisenderId : null,
      isProfileDelete,
    })
  }

  const executeDeleteForPersons = async (selectedTravelerIds: string[]) => {
    if (!deletePersonsConfirm || selectedTravelerIds.length === 0) return
    const { packingItemId } = deletePersonsConfirm
    setDeletePersonsConfirm(null)
    pendingMutationsRef.current += 1
    setIsLoading(true)
    try {
      for (const mitreisenderId of selectedTravelerIds) {
        const res = await fetch(
          `/api/packing-items/remove-mitreisender?packingItemId=${packingItemId}&mitreisenderId=${mitreisenderId}`,
          { method: 'DELETE' }
        )
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          alert('Fehler beim Entfernen: ' + (data.error ?? 'Unbekannt'))
        }
      }
      if (selectedVacationId) {
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
          cache: 'no-store',
        })
        const itemsData = (await itemsRes.json()) as ApiResponse<PackingItem[]>
        if (itemsData.success && itemsData.data && itemsData.data.length > 0) {
          applyPackingItemsFromFetch(itemsData.data)
        }
      }
    } catch (error) {
      console.error('Failed to remove from packing item:', error)
      alert('Fehler beim Entfernen')
    } finally {
      pendingMutationsRef.current -= 1
      setIsLoading(false)
    }
  }

  const executeDeletePackingItem = async () => {
    if (!deletePackingItemConfirm) return
    const { id, forMitreisenderId, isProfileDelete } = deletePackingItemConfirm

    pendingMutationsRef.current += 1
    setIsLoading(true)
    try {
      if (isProfileDelete) {
        const res = await fetch(
          `/api/packing-items/remove-mitreisender?packingItemId=${id}&mitreisenderId=${forMitreisenderId}`,
          { method: 'DELETE' }
        )
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          alert('Fehler beim Entfernen: ' + (data.error ?? 'Unbekannt'))
        }
      } else {
        const res = await fetch(`/api/packing-items?id=${id}`, { method: 'DELETE' })
        const data = (await res.json()) as ApiResponse<boolean>
        if (!data.success) {
          alert('Fehler beim Löschen: ' + (data.error ?? 'Unbekannt'))
        }
      }

      if (selectedVacationId) {
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
          cache: 'no-store',
        })
        const itemsData = (await itemsRes.json()) as ApiResponse<PackingItem[]>
        if (itemsData.success && itemsData.data && itemsData.data.length > 0) {
          applyPackingItemsFromFetch(itemsData.data)
        }
      }
    } catch (error) {
      console.error('Failed to delete packing item:', error)
      alert('Fehler beim Löschen')
    } finally {
      pendingMutationsRef.current -= 1
      setIsLoading(false)
    }
  }

  const handleToggleEquipmentSelection = (equipmentId: string) => {
    const newSelection = new Set(selectedEquipmentIds)
    if (newSelection.has(equipmentId)) {
      newSelection.delete(equipmentId)
    } else {
      newSelection.add(equipmentId)
    }
    setSelectedEquipmentIds(newSelection)
  }

  const handleAddSelectedEquipment = async () => {
    if (selectedEquipmentIds.size === 0 || !selectedVacationId) return
    pendingMutationsRef.current += 1

    setIsLoading(true)
    try {
      const vacationMitreisendeIds = vacationMitreisende.map((m) => m.id)
      const vacationMitreisendeById = new Map(vacationMitreisende.map((m) => [m.id, m]))
      const reiseTage = currentVacation ? berechneReiseTage(currentVacation) : 1

      // Zeilen-anzahl und Pro-Person-Anzahlen für einen neuen Eintrag berechnen.
      // Bei personenbezogenen Einträgen mit Regel: Pro-Person rechnen + Summe als Zeilenwert.
      const buildItemPayload = (eq: EquipmentItem | undefined, expectedIds: string[]) => {
        const typ = (eq?.mitreisenden_typ ?? 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte'
        if (eq?.mengenregel && typ !== 'pauschal' && expectedIds.length > 0) {
          const mitreisendeMitAnzahl = expectedIds.map((id) => {
            const person = vacationMitreisendeById.get(id)
            const anzahl = berechneAnzahl(
              eq.mengenregel,
              reiseTage,
              person ? istKind(person) : false,
            )
            return { id, anzahl }
          })
          // pe.anzahl = Erwachsenen-Wert als Pro-Person-Default, die individuellen
          // Werte liegen in mitreisende[].anzahl (→ keine irreführende Summe in „Alle").
          const erwachsenenWert = berechneAnzahl(eq.mengenregel, reiseTage, false)
          return { anzahl: Math.max(erwachsenenWert, 1), mitreisende: mitreisendeMitAnzahl as Array<string | { id: string; anzahl?: number | null }> }
        }
        const anzahl = eq?.mengenregel
          ? berechneAnzahl(eq.mengenregel, reiseTage, false)
          : eq?.standard_anzahl ?? 1
        return { anzahl: Math.max(anzahl, 0), mitreisende: expectedIds as Array<string | { id: string; anzahl?: number | null }> }
      }

      if (selectedPackProfile) {
        // Packprofil Mitreisender: Person zu bestehendem Eintrag hinzufügen oder neuen erstellen
        for (const equipmentId of selectedEquipmentIds) {
          const eq = equipmentItems.find((e) => e.id === equipmentId)
          const existingItem = packingItems.find((p) => p.gegenstand_id === equipmentId)

          if (existingItem) {
            // Eintrag existiert – Person per Toggle hinzufügen. Bei aktiver
            // Mengenregel zusätzlich die pro-Person-Anzahl mitschicken, damit
            // nachträglich ergänzte Personen nicht die Menge der Erst-Zuordnung
            // erben, sondern ihren eigenen Regel-Wert bekommen.
            let addAnzahl: number | null = null
            if (eq?.mengenregel) {
              const person = vacationMitreisendeById.get(selectedPackProfile)
              addAnzahl = berechneAnzahl(eq.mengenregel, reiseTage, person ? istKind(person) : false)
            }
            const res = await fetch('/api/packing-items/toggle-mitreisender', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                packingItemId: existingItem.id,
                mitreisenderId: selectedPackProfile,
                gepackt: false,
                anzahl: addAnzahl,
              })
            })
            if (!res.ok) {
              console.error('Failed to add mitreisender to item:', existingItem.id)
            }
          } else {
            // Neuer Eintrag – nur für diesen Mitreisenden
            const payload = buildItemPayload(eq, [selectedPackProfile])
            await fetch('/api/packing-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vacationId: selectedVacationId,
                gegenstandId: equipmentId,
                anzahl: payload.anzahl,
                bemerkung: null,
                transportId: eq?.transport_id ?? null,
                mitreisende: payload.mitreisende
              })
            })
          }
        }
      } else {
        // Packprofil Alle: Neuen Eintrag anlegen oder nur fehlende Zuordnungen zum bestehenden Eintrag ergänzen
        const vacationMitreisendeSet = new Set(vacationMitreisendeIds)
        const promises: Promise<Response>[] = []
        for (const equipmentId of selectedEquipmentIds) {
          const eq = equipmentItems.find((e) => e.id === equipmentId)
          const existingItem = packingItems.find((p) => p.gegenstand_id === equipmentId)
          const existingIds = new Set((existingItem?.mitreisende ?? []).map((m) => m.mitreisender_id))

          let expectedIds: string[]
          if (eq?.mitreisenden_typ === 'alle') {
            expectedIds = vacationMitreisendeIds
          } else if (eq?.mitreisenden_typ === 'ausgewaehlte' && eq.standard_mitreisende?.length) {
            expectedIds = eq.standard_mitreisende.filter((id) => vacationMitreisendeSet.has(id))
          } else {
            expectedIds = []
          }

          if (!existingItem) {
            // Neuer Eintrag: vollständige Zuordnung anlegen
            const payload = buildItemPayload(eq, expectedIds)
            promises.push(
              fetch('/api/packing-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vacationId: selectedVacationId,
                  gegenstandId: equipmentId,
                  anzahl: payload.anzahl,
                  bemerkung: null,
                  transportId: eq?.transport_id ?? null,
                  mitreisende: payload.mitreisende
                })
              })
            )
          } else {
            // Bestehender Eintrag: nur fehlende Mitreisende hinzufügen (keine Doppel).
            // Bei Mengenregel-Einträgen pro Person individuell berechnen.
            const missingIds = expectedIds.filter((id) => !existingIds.has(id))
            for (const mitreisenderId of missingIds) {
              let addAnzahl: number | null = null
              if (eq?.mengenregel) {
                const person = vacationMitreisendeById.get(mitreisenderId)
                addAnzahl = berechneAnzahl(eq.mengenregel, reiseTage, person ? istKind(person) : false)
              }
              promises.push(
                fetch('/api/packing-items/toggle-mitreisender', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    packingItemId: existingItem.id,
                    mitreisenderId,
                    gepackt: false,
                    anzahl: addAnzahl,
                  })
                })
              )
            }
          }
        }
        await Promise.all(promises)
      }

      const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
        cache: 'no-store',
      })
      const itemsData = (await itemsRes.json()) as ApiResponse<PackingItem[]>
      if (itemsData.success && itemsData.data && itemsData.data.length > 0) {
        applyPackingItemsFromFetch(itemsData.data)
      }

      setShowAddItemDialog(false)
      setSelectedEquipmentIds(new Set())
      setSearchTerm('')
    } catch (error) {
      console.error('Failed to add equipment items:', error)
      alert('Fehler beim Hinzufügen der Gegenstände')
    } finally {
      pendingMutationsRef.current -= 1
      setIsLoading(false)
    }
  }

  const travelerNames = vacationMitreisende.map((m) => m.name)
  const getTravelerInitials = (name: string) => getInitials(name, travelerNames)
  const sortedVacationMitreisende = useMemo(
    () => sortMitreisendeNachRolleUndName(vacationMitreisende),
    [vacationMitreisende]
  )

  // Add-Dialog: beim Öffnen zur aktuellen Kategorie scrollen (einmalig, sanft)
  useEffect(() => {
    if (!showAddItemDialog) return
    const ctx = addDialogScrollContextRef.current
    if (!ctx?.mainCategory) return
    const id = setTimeout(() => {
      const scrollEl = addDialogScrollRef.current
      if (!scrollEl) return
      const allWithMain = scrollEl.querySelectorAll<HTMLElement>('[data-main-category]')
      let target: HTMLElement | null = null
      for (const el of allWithMain) {
        if (el.dataset.mainCategory !== ctx.mainCategory) continue
        if (ctx.category && el.dataset.category === ctx.category) {
          target = el
          break
        }
        if (!target) target = el
      }
      if (target) {
        const containerRect = scrollEl.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const scrollTop = targetRect.top - containerRect.top + scrollEl.scrollTop - 8
        const finalTop = Math.max(0, scrollTop)
        const animateDistance = 120
        const instantTop = Math.max(0, finalTop - animateDistance)
        scrollEl.scrollTo({ top: instantTop, behavior: 'auto' })
        requestAnimationFrame(() => {
          scrollEl.scrollTo({ top: finalTop, behavior: 'smooth' })
        })
      }
    }, 200)
    return () => clearTimeout(id)
  }, [showAddItemDialog])

  if (!storageHydrated) {
    return (
      <div className="min-h-screen flex max-w-full overflow-x-clip">
        <NavigationSidebar
          isOpen={showNavSidebar}
          onClose={() => setShowNavSidebar(false)}
        />
        <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
          <div className="min-w-0 h-full">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Lädt…</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      {/* Navigation Sidebar (Links) */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300 min-w-0",
        "lg:ml-[280px]"
      )}>
        <div className={cn("min-w-0", currentVacation ? "h-dvh overflow-hidden flex flex-col" : "h-full")}>
          {/* Vacation Selected */}
          {currentVacation && (
            <div className="flex-1 min-h-0 flex flex-col min-w-0">
              {/* Header - fix oben, scrollt nicht (Flex-Layout: Header+Progress+Tabs bleiben sichtbar) */}
              <div className="flex-shrink-0 z-20 bg-card min-w-0">
                <div className="py-3 px-4 flex items-center justify-between gap-3 min-w-0 w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Mobile Menu Toggle - einheitlich mit Rahmen wie auf Urlaube */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNavSidebar(true)}
                      className="lg:hidden flex-shrink-0"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-xl font-bold text-brand-heading truncate">
                        {currentVacation.titel}
                      </h1>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {new Date(currentVacation.startdatum).toLocaleDateString('de-DE')} - {new Date(currentVacation.enddatum).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>

                  {/* Pack Profile Button - Nutzt Farbe des ausgewählten Profils */}
                  {packingItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPackSettings(true)}
                      className="flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(45,79,30)] focus:ring-offset-2 rounded-full"
                    >
                      <div
                        className="h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-bold"
                        style={
                          selectedPackProfile
                            ? (() => {
                                const index = sortedVacationMitreisende.findIndex(
                                  (x) => x.id === selectedPackProfile
                                )
                                const m =
                                  index >= 0
                                    ? sortedVacationMitreisende[index]
                                    : vacationMitreisende.find(
                                        (x) => x.id === selectedPackProfile
                                      )
                                return getMitreisenderAvatarStyle(
                                  m,
                                  index >= 0 ? index : 0
                                )
                              })()
                            : { backgroundColor: 'rgb(45,79,30)', color: '#ffffff' }
                        }
                      >
                        {selectedPackProfile ? (
                          getTravelerInitials(vacationMitreisende.find((m) => m.id === selectedPackProfile)?.name ?? '?')
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Packing List: Progress + Tabs fix oben, Inhalt scrollt */}
              <PackingList
                  items={packingItems}
                  onToggle={handleTogglePacked}
                  onSetPacked={handleSetPacked}
                  onToggleMitreisender={handleToggleMitreisender}
                  onToggleMultipleMitreisende={handleToggleMultipleMitreisende}
                  onEdit={handleEditPackingItem}
                  onDelete={handleDeletePackingItem}
                  onConfirmVorgemerkt={handleConfirmVorgemerkt}
                  onRemoveVorgemerkt={handleRemoveVorgemerkt}
                  canConfirmVorgemerkt={canAccessConfig}
                  selectedProfile={selectedPackProfile}
                  hidePackedItems={hidePackedItems}
                  canEditPauschalEntries={canEditPauschalEntries}
                  selectedProfileColor={vacationMitreisende.find(m => m.id === selectedPackProfile)?.farbe ?? undefined}
                  isChildView={!canSelectOtherProfiles}
                  listDisplayMode={listDisplayMode}
                  onOpenSettings={() => setShowPackSettings(true)}
                  vacationMitreisende={vacationMitreisende}
                  transportVehicles={transportVehicles}
                  visiblePackProfileMitreisende={
                    canSelectOtherProfiles || !user?.mitreisender_id
                      ? vacationMitreisende
                      : vacationMitreisende.filter((m) => m.id === user.mitreisender_id)
                  }
                  abreiseDatum={currentVacation?.abfahrtdatum?.trim() || currentVacation?.startdatum || null}
                  onScrollContextChange={handleScrollContextChange}
                  canSelectOtherProfiles={canSelectOtherProfiles}
                  activeMainCategory={activeMainCategory}
                  onActiveMainCategoryChange={handleActiveMainCategoryChange}
                  onProfileChange={handlePackProfileChange}
              />

              {/* Auto-generate button - Only when list is empty */}
              {packingItems.length === 0 && !packingHadContentRef.current && (
                <div className="p-6 text-center bg-card">
                  <p className="text-muted-foreground mb-4">
                    Ihre Packliste ist leer. Generieren Sie automatisch Vorschläge oder fügen Sie manuell Gegenstände hinzu.
                  </p>
                  <Button 
                    onClick={() => setShowGeneratorDialog(true)}
                    size="lg"
                    className="bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Automatisch generieren
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* No Vacation Selected */}
          {!currentVacation && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub über die Navigation!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Edit Item Dialog */}
          <ResponsiveModal
            open={showEditItemDialog}
            onOpenChange={setShowEditItemDialog}
            title={
              editingForMitreisenderId &&
              packingItems.find((p) => p.id === editingPackingItemId)?.is_temporaer
                ? 'Packlisten-Eintrag bearbeiten'
                : editingForMitreisenderId
                  ? 'Anzahl für Mitreisenden anpassen'
                  : 'Packlisten-Eintrag bearbeiten'
            }
            description={
              editingForMitreisenderId &&
              packingItems.find((p) => p.id === editingPackingItemId)?.is_temporaer
                ? 'Bezeichnung, Kategorie sowie für diesen Mitreisenden Anzahl und Transport'
                : editingForMitreisenderId
                  ? 'Änderung gilt nur für diesen Mitreisenden'
                  : packingItems.find((p) => p.id === editingPackingItemId)?.is_temporaer
                    ? 'Bezeichnung, Kategorie, Anzahl und Bemerkung anpassen'
                    : 'Anzahl und Bemerkung anpassen'
            }
          >
            <div className="space-y-4">
              {(() => {
                const editItem = packingItems.find((p) => p.id === editingPackingItemId)
                if (!editItem?.is_temporaer) return null
                return (
                  <>
                    <div>
                      <Label htmlFor="edit-was">Bezeichnung</Label>
                      <Input
                        id="edit-was"
                        value={packingItemForm.was}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, was: e.target.value })}
                        placeholder="Name des Gegenstands"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-kategorie">Kategorie</Label>
                      <CategoryGroupedSelectField
                        triggerId="edit-kategorie"
                        value={packingItemForm.kategorieId}
                        onValueChange={(v) => setPackingItemForm({ ...packingItemForm, kategorieId: v })}
                        categories={categories}
                        mainCategories={mainCategories}
                      />
                    </div>
                  </>
                )
              })()}
              <div>
                <Label htmlFor="edit-anzahl">Anzahl</Label>
                <Input
                  id="edit-anzahl"
                  type="number"
                  min="1"
                  value={packingItemForm.anzahl}
                  onChange={(e) => setPackingItemForm({ ...packingItemForm, anzahl: e.target.value })}
                />
                {(() => {
                  // Info-Tooltip: Zeigt, ob der Wert aus einer Mengenregel berechnet wurde.
                  // Nutzer kann den Wert weiterhin manuell überschreiben.
                  const eq = equipmentItems.find((e) => e.id === packingItemForm.gegenstandId)
                  if (!eq?.mengenregel) return null
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Ursprünglich berechnet aus Regel: {regelKurzLabel(eq.mengenregel)}
                    </p>
                  )
                })()}
              </div>
              {!editingForMitreisenderId && (
              <div>
                <Label htmlFor="edit-bemerkung">Bemerkung (optional)</Label>
                <Input
                  id="edit-bemerkung"
                  placeholder="z.B. nur für Wanderungen"
                  value={packingItemForm.bemerkung}
                  onChange={(e) => setPackingItemForm({ ...packingItemForm, bemerkung: e.target.value })}
                />
              </div>
              )}
              <div>
                <Label htmlFor="edit-transport">Transport</Label>
                <Select
                  value={packingItemForm.transportId || 'none'}
                  onValueChange={(v) =>
                    setPackingItemForm({
                      ...packingItemForm,
                      transportId: v === 'none' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Transport</SelectItem>
                    {transportVehicles.map((tv) => (
                      <SelectItem key={tv.id} value={tv.id}>
                        {tv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingForMitreisenderId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Gilt nur für diese Person.
                  </p>
                )}
              </div>
              <Button onClick={handleUpdatePackingItem} disabled={isLoading} className="w-full">
                {isLoading ? 'Wird aktualisiert...' : 'Aktualisieren'}
              </Button>
            </div>
          </ResponsiveModal>

          {/* Packlisten-Eintrag löschen – Bestätigung */}
          <ConfirmDialog
            open={!!deletePackingItemConfirm}
            onOpenChange={(open) => !open && setDeletePackingItemConfirm(null)}
            title={deletePackingItemConfirm?.isProfileDelete ? 'Eintrag entfernen' : 'Eintrag löschen'}
            description={
              deletePackingItemConfirm?.isProfileDelete
                ? 'Diesen Eintrag nur für diesen Mitreisenden entfernen?'
                : 'Möchten Sie diesen Eintrag wirklich aus der Packliste entfernen?'
            }
            confirmLabel={deletePackingItemConfirm?.isProfileDelete ? 'Entfernen' : 'Löschen'}
            onConfirm={executeDeletePackingItem}
            isLoading={isLoading}
          />

          {/* Packprofil „Alle“: personenbezogener Eintrag – Für wen von der Packliste entfernen? */}
          <MarkAllConfirmationDialog
            isOpen={!!deletePersonsConfirm}
            onClose={() => setDeletePersonsConfirm(null)}
            onConfirm={executeDeleteForPersons}
            _itemName=""
            travelers={deletePersonsConfirm?.travelers ?? []}
            deleteMode
          />
        </div>
      </div>

      {/* Pack Settings Sidebar (Rechts) – Kind/Gast nur eigenes Profil */}
      <PackingSettingsSidebar
        isOpen={showPackSettings}
        onClose={() => setShowPackSettings(false)}
        mitreisende={
          canSelectOtherProfiles || !user?.mitreisender_id
            ? vacationMitreisende
            : vacationMitreisende.filter((m) => m.id === user.mitreisender_id)
        }
        selectedProfile={selectedPackProfile}
        onProfileChange={handlePackProfileChange}
        hidePackedItems={hidePackedItems}
        onHidePackedChange={handleHidePackedChange}
        listDisplayMode={listDisplayMode}
        onListDisplayModeChange={handleListDisplayModeChange}
        showAlleOption={canSelectOtherProfiles}
      />

      {/* FAB Button für Gegenstand hinzufügen - Kreisrund mit weißem Plus */}
      {currentVacation && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="icon"
            onClick={() => setShowAddItemDialog(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      )}

      {/* Add Equipment Dialog - Drawer auf Mobile, Dialog auf Desktop */}
      <ResponsiveModal
        open={showAddItemDialog}
        onOpenChange={(open) => {
          setShowAddItemDialog(open)
          if (!open) {
            setSelectedEquipmentIds(new Set())
            setSearchTerm('')
          }
        }}
        title=""
        customContent
        hideCloseButton
        contentClassName="max-w-4xl max-h-[90vh] sm:max-h-[90vh] h-[85vh] sm:h-auto flex flex-col"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-6 pt-6 pb-0 flex-shrink-0 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Gegenstände hinzufügen</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddSingleItemInitialName(searchTerm)
                setAddSingleItemScrollMain(addDialogScrollContextRef.current?.mainCategory ?? null)
                setShowAddSingleItemDialog(true)
              }}
            >
              Neu
            </Button>
          </div>

          {/* Search Bar */}
          <div className="px-6 pt-4 pb-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Gegenständen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Equipment List - Scrollable */}
          <div
            ref={addDialogScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 min-w-0"
          >
            {groupedAvailableEquipment.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-4">
                <p>
                  {searchTerm ? 'Keine Gegenstände gefunden' : 'Alle Gegenstände sind bereits auf der Packliste'}
                </p>
                {searchTerm && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
                    onClick={() => {
                      setAddSingleItemInitialName(searchTerm)
                      setAddSingleItemScrollMain(addDialogScrollContextRef.current?.mainCategory ?? null)
                      setShowAddSingleItemDialog(true)
                    }}
                  >
                    Neu anlegen
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedAvailableEquipment.map(mainGroup => (
                  <div key={mainGroup.id} data-main-category={mainGroup.name}>
                    {/* Main Category Header */}
                    <div className="bg-[rgb(45,79,30)] text-white px-4 py-2 rounded-t-lg font-bold">
                      {mainGroup.name}
                    </div>
                    
                    {/* Categories */}
                    {mainGroup.categories.map(category => (
                      <div
                        key={category.id}
                        data-main-category={mainGroup.name}
                        data-category={category.name}
                        className="border-x border-b last:rounded-b-lg"
                      >
                        {/* Category Header */}
                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                          {category.name} ({category.items.length})
                        </div>
                        
                        {/* Items */}
                        <div className="divide-y divide-gray-200 bg-card">
                          {category.items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-gray-50 cursor-pointer min-w-0"
                              onClick={() => handleToggleEquipmentSelection(item.id)}
                            >
                              <Checkbox
                                checked={selectedEquipmentIds.has(item.id)}
                                onCheckedChange={() => handleToggleEquipmentSelection(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="font-medium truncate">{item.was}</div>
                                {item.details && (
                                  <div className="text-sm text-muted-foreground truncate">
                                    {item.details}
                                  </div>
                                )}
                              </div>
                              {item.einzelgewicht != null && (
                                <div className="text-sm text-muted-foreground flex-shrink-0">
                                  {formatWeight(item.einzelgewicht)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="px-6 pt-4 pb-6 bg-card flex gap-2 flex-shrink-0">
            <Button
              onClick={handleAddSelectedEquipment}
              disabled={selectedEquipmentIds.size === 0 || isLoading}
              className="flex-1 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
            >
              {isLoading ? 'Wird hinzugefügt...' : `${selectedEquipmentIds.size} Gegenstand${selectedEquipmentIds.size !== 1 ? 'e' : ''} hinzufügen`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddItemDialog(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Packing List Generator Dialog */}
      <PackingListGenerator
        open={showGeneratorDialog}
        onOpenChange={setShowGeneratorDialog}
        vacationId={selectedVacationId || ''}
        onGenerate={handleGeneratePackingList}
      />

      {/* Neu anlegen (temporär oder in Ausrüstung) */}
      <AddSingleItemDialog
        open={showAddSingleItemDialog}
        onOpenChange={(open) => {
          setShowAddSingleItemDialog(open)
          if (!open) setAddSingleItemScrollMain(null)
        }}
        initialName={addSingleItemInitialName}
        vacationId={selectedVacationId || ''}
        vacationMitreisende={vacationMitreisende}
        selectedPackProfile={selectedPackProfile}
        mainCategories={mainCategories}
        categorySelectScrollTarget={
          addSingleItemScrollMain ? { kind: 'mainHeading', mainTitle: addSingleItemScrollMain } : null
        }
        categories={categories}
        transportVehicles={transportVehicles}
        onSuccess={async () => {
          // Nach dem Hinzufügen (insbesondere temporär) beide Dialoge schließen:
          // den „Neu“-Dialog und die ursprüngliche Auswahl-Liste.
          setShowAddSingleItemDialog(false)
          setAddSingleItemScrollMain(null)
          setShowAddItemDialog(false)
          if (selectedVacationId) {
            const res = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`, {
        cache: 'no-store',
      })
            const data = (await res.json()) as ApiResponse<PackingItem[]>
            if (data.success && data.data && data.data.length > 0) {
              applyPackingItemsFromFetch(data.data)
            }
          }
          const eqRes = await fetch('/api/equipment-items')
          const eqData = (await eqRes.json()) as ApiResponse<EquipmentItem[]>
          if (eqData.success && eqData.data) setEquipmentItems(eqData.data)
        }}
      />
    </div>
  )
}

export default function Home() {
  return <HomeContent />
}
