'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SmartSuggestionCard } from '@/components/smart-suggestion-card'
import { BrandEmptyState } from '@/components/brand-empty-state'
import {
  EMPTY_ILLUSTRATION_CLASS,
  SuggestionsEmptyIllustration,
} from '@/components/brand-empty-illustrations'
import { EquipmentAddDialog } from '@/components/equipment/equipment-add-dialog'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { Category, MainCategory, Mitreisender, Tag, TagKategorie, TransportVehicle } from '@/lib/db'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { useSmartSuggestionAct } from '@/hooks/use-smart-suggestion-act'
import { useSuggestionFocusFlash, useSuggestionFocusId } from '@/hooks/use-suggestion-focus-flash'
import { useAuth } from '@/components/auth-provider'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useCategorySuggestion } from '@/hooks/use-category-suggestion'
import { showQueuedToast } from '@/lib/offline-toast'
import {
  cacheCategories,
  cacheMainCategories,
  cacheMitreisende,
  cacheTagKategorien,
  cacheTags,
  cacheTransportVehicles,
} from '@/lib/offline-db'
import {
  getCachedCategories,
  getCachedMainCategories,
  getCachedMitreisende,
  getCachedTagKategorien,
  getCachedTags,
  getCachedTransportVehicles,
  notifyEquipmentChanged,
} from '@/lib/offline-sync'
import type { CategorySelectScrollTarget } from '@/components/category-select-grouped'
import {
  buildEquipmentApiPayload,
  buildTagGroupsForEquipment,
  createDefaultEquipmentFormValues,
  getEquipmentFormValidationError,
  mitreisendenZeileAusApi,
  type EquipmentFormValues,
  type MitreisendenZeile,
} from '@/lib/equipment-form'
import type { TempPromotePrefillHint } from '@/lib/temp-promote-prefill'
import { postSmartSuggestionAction } from '@/lib/smart-suggestion-client'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

type TempPromotePrefillResponse = {
  form: Pick<
    EquipmentFormValues,
    'was' | 'kategorie_id' | 'transport_id' | 'einzelgewicht' | 'standard_anzahl'
  >
  hints: TempPromotePrefillHint[]
  sampleCount: number
}

function VorschlaegePageContent() {
  const focusId = useSuggestionFocusId()
  const { canAccessConfig } = useAuth()
  const { mutate } = useOptimisticMutation()
  const [showNav, setShowNav] = useState(false)
  const [items, setItems] = useState<SmartSuggestion[]>([])

  const [promoteSuggestion, setPromoteSuggestion] = useState<SmartSuggestion | null>(null)
  const [promoteForm, setPromoteForm] = useState<EquipmentFormValues>(createDefaultEquipmentFormValues())
  const [promoteHints, setPromoteHints] = useState<TempPromotePrefillHint[]>([])
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [promoteSaving, setPromoteSaving] = useState(false)
  const [individuelleMitreisendeExtraOffen, setIndividuelleMitreisendeExtraOffen] = useState(false)
  const [promoteScrollTarget, setPromoteScrollTarget] = useState<CategorySelectScrollTarget | null>(
    null
  )

  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])
  const [mitreisende, setMitreisende] = useState<MitreisendenZeile[]>([])
  const [catalogReady, setCatalogReady] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/suggestions', { cache: 'no-store' })
    const json = (await res.json()) as ApiResponse<SmartSuggestion[]>
    if (json.success && json.data) {
      setItems(json.data)
      notifySmartSuggestionsChanged(json.data.length)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useReconnectRefetch(() => {
    void load()
  })

  const { busyId, act } = useSmartSuggestionAct(load)
  const focusReady = Boolean(focusId && items.some((s) => s.id === focusId))
  const flashing = useSuggestionFocusFlash(focusReady ? focusId : null)

  const tagGroupsForEquipment = useMemo(
    () => buildTagGroupsForEquipment(tagKategorien, tags),
    [tagKategorien, tags]
  )

  const promoteOpen = Boolean(promoteSuggestion)
  const { suggestion: categorySuggestion, loading: categoryLoading } = useCategorySuggestion(
    promoteForm.was,
    promoteOpen
  )

  useEffect(() => {
    if (!promoteOpen || !categorySuggestion || promoteForm.kategorie_id) return
    setPromoteForm((prev) =>
      prev.kategorie_id ? prev : { ...prev, kategorie_id: categorySuggestion.kategorie_id }
    )
  }, [promoteOpen, categorySuggestion, promoteForm.kategorie_id])

  const ensureEquipmentCatalog = useCallback(async () => {
    if (catalogReady) return
    const loadJson = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await fetch(url)
        const json = (await res.json()) as ApiResponse<T>
        return json.success && json.data ? json.data : null
      } catch {
        return null
      }
    }

    const [cats, mains, transports, tagsData, tagKats, mit] = await Promise.all([
      loadJson<CategoryWithMain[]>('/api/categories'),
      loadJson<MainCategory[]>('/api/main-categories'),
      loadJson<TransportVehicle[]>('/api/transport-vehicles'),
      loadJson<Tag[]>('/api/tags'),
      loadJson<TagKategorie[]>('/api/tag-kategorien'),
      loadJson<Mitreisender[]>('/api/mitreisende'),
    ])

    if (cats) {
      setCategories(cats)
      void cacheCategories(cats)
    } else {
      const cached = await getCachedCategories()
      if (cached.length > 0) setCategories(cached as CategoryWithMain[])
    }
    if (mains) {
      setMainCategories(mains)
      void cacheMainCategories(mains)
    } else {
      const cached = await getCachedMainCategories()
      if (cached.length > 0) setMainCategories(cached)
    }
    if (transports) {
      setTransportVehicles(transports)
      void cacheTransportVehicles(transports)
    } else {
      const cached = await getCachedTransportVehicles()
      if (cached.length > 0) setTransportVehicles(cached)
    }
    if (tagsData) {
      setTags(tagsData)
      void cacheTags(tagsData)
    } else {
      const cached = await getCachedTags()
      if (cached.length > 0) setTags(cached)
    }
    if (tagKats) {
      setTagKategorien(tagKats)
      void cacheTagKategorien(tagKats)
    } else {
      const cached = await getCachedTagKategorien()
      if (cached.length > 0) setTagKategorien(cached)
    }
    if (mit) {
      setMitreisende(mit.map(mitreisendenZeileAusApi))
      void cacheMitreisende(mit)
    } else {
      const cached = await getCachedMitreisende()
      if (cached.length > 0) setMitreisende(cached.map(mitreisendenZeileAusApi))
    }
    setCatalogReady(true)
  }, [catalogReady])

  const openTempPromoteDialog = useCallback(
    async (suggestion: SmartSuggestion) => {
      const was = String(suggestion.payload.was ?? '').trim()
      const kategorieId = String(suggestion.payload.kategorie_id ?? '').trim()
      if (!was || !kategorieId) {
        alert('Vorschlag unvollständig – Name oder Kategorie fehlt.')
        return
      }

      setPromoteBusy(true)
      setIndividuelleMitreisendeExtraOffen(false)

      try {
        await ensureEquipmentCatalog()

        let nextForm = {
          ...createDefaultEquipmentFormValues(was),
          kategorie_id: kategorieId,
        }
        let nextHints: TempPromotePrefillHint[] = []

        const qs = new URLSearchParams({ was, kategorie_id: kategorieId })
        const res = await fetch(`/api/suggestions/temp-promote-prefill?${qs}`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as ApiResponse<TempPromotePrefillResponse>
        if (json.success && json.data) {
          nextForm = {
            ...nextForm,
            was: json.data.form.was || was,
            kategorie_id: json.data.form.kategorie_id || kategorieId,
            transport_id: json.data.form.transport_id || 'none',
            einzelgewicht: json.data.form.einzelgewicht ?? '',
            standard_anzahl: json.data.form.standard_anzahl || '1',
          }
          nextHints = json.data.hints ?? []
        }

        setPromoteForm(nextForm)
        setPromoteHints(nextHints)
        setPromoteScrollTarget(
          nextForm.kategorie_id
            ? { kind: 'categoryRow', categoryId: nextForm.kategorie_id }
            : null
        )
        setPromoteSuggestion(suggestion)
      } catch (error) {
        console.error('temp-promote prefill failed:', error)
        setPromoteForm({
          ...createDefaultEquipmentFormValues(was),
          kategorie_id: kategorieId,
        })
        setPromoteHints([])
        setPromoteScrollTarget(
          kategorieId ? { kind: 'categoryRow', categoryId: kategorieId } : null
        )
        setPromoteSuggestion(suggestion)
      } finally {
        setPromoteBusy(false)
      }
    },
    [ensureEquipmentCatalog]
  )

  const closePromoteDialog = useCallback((open: boolean) => {
    if (open) return
    setPromoteSuggestion(null)
    setPromoteHints([])
    setPromoteScrollTarget(null)
    setIndividuelleMitreisendeExtraOffen(false)
    setPromoteForm(createDefaultEquipmentFormValues())
  }, [])

  const savePromoteEquipment = useCallback(async () => {
    if (!promoteSuggestion) return
    const validationError = getEquipmentFormValidationError(promoteForm)
    if (validationError) {
      alert(validationError)
      return
    }

    setPromoteSaving(true)
    try {
      const clientId = crypto.randomUUID()
      const result = await mutate({
        table: 'equipment-items',
        action: 'post',
        key: clientId,
        payload: { id: clientId, ...buildEquipmentApiPayload(promoteForm) },
      })
      if (!result.ok && !result.queued) {
        alert('Fehler beim Speichern' + (result.error ? `: ${result.error}` : ''))
        return
      }
      if (result.queued) {
        showQueuedToast()
      }
      notifyEquipmentChanged()

      const accept = await postSmartSuggestionAction(promoteSuggestion.id, 'accept')
      if (!accept.ok) {
        alert(
          accept.error ||
            'Ausrüstung gespeichert, aber Vorschlag konnte nicht als erledigt markiert werden.'
        )
      }
      closePromoteDialog(false)
      await load()
    } catch (error) {
      console.error('Failed to save equipment from temp_promote:', error)
      alert('Fehler beim Speichern')
    } finally {
      setPromoteSaving(false)
    }
  }, [promoteSuggestion, promoteForm, mutate, closePromoteDialog, load])

  const handleCardAct = useCallback(
    (suggestion: SmartSuggestion, action: 'accept' | 'dismiss' | 'snooze', extra?: { url?: string }) => {
      if (action === 'accept' && suggestion.kind === 'temp_promote' && canAccessConfig) {
        void openTempPromoteDialog(suggestion)
        return
      }
      void act(suggestion.id, action, extra)
    },
    [act, canAccessConfig, openTempPromoteDialog]
  )

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNav} onClose={() => setShowNav(false)} />
      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col min-h-screen gap-0">
          <div className="sticky top-0 z-30 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 mb-6">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNav(true)}
                className="lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Vorschläge
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Muster aus euren Packlisten und Campingplätzen – nichts wird still gespeichert.
                  „Später“ blendet einen Hinweis für 7 Tage aus.
                </p>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <BrandEmptyState
              illustration={
                <SuggestionsEmptyIllustration className={EMPTY_ILLUSTRATION_CLASS} />
              }
              title="Alles im Lot"
              description="Gerade gibt es nichts zu prüfen. Sobald sich Muster aus euren Packlisten oder Campingplätzen ergeben, erscheinen die Hinweise hier."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 min-w-0">
              {items.map((s) => (
                <SmartSuggestionCard
                  key={s.id}
                  suggestion={s}
                  busy={busyId === s.id || (promoteBusy && promoteSuggestion?.id === s.id)}
                  highlighted={flashing && s.id === focusId}
                  canCreateEquipment={canAccessConfig}
                  onAct={(action, extra) => handleCardAct(s, action, extra)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {canAccessConfig && (
        <EquipmentAddDialog
          open={promoteOpen}
          onOpenChange={closePromoteDialog}
          title="Neuen Gegenstand hinzufügen"
          description={
            promoteSuggestion
              ? `Aus temporären Packlisteneinträgen „${String(promoteSuggestion.payload.was ?? '')}“.`
              : undefined
          }
          value={promoteForm}
          onChange={setPromoteForm}
          categories={categories}
          mainCategories={mainCategories}
          transportVehicles={transportVehicles}
          tagGroups={tagGroupsForEquipment}
          mitreisende={mitreisende}
          individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOffen}
          onIndividuelleMitreisendeExtraOpenChange={setIndividuelleMitreisendeExtraOffen}
          categorySelectScrollTarget={promoteScrollTarget}
          lifecycleSessionKey={
            promoteSuggestion ? `temp-promote:${promoteSuggestion.id}` : 'temp-promote'
          }
          prefillHints={promoteHints}
          onSave={savePromoteEquipment}
          isSaving={promoteSaving}
          afterFields={
            <>
              {categoryLoading && (
                <p className="text-xs text-muted-foreground">Kategorie wird vorgeschlagen…</p>
              )}
              {categorySuggestion?.duplicate && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Ähnlich zu vorhandener Ausrüstung „{categorySuggestion.duplicate.was}“.
                </p>
              )}
              {categorySuggestion && !categorySuggestion.duplicate && !promoteForm.kategorie_id && (
                <p className="text-xs text-muted-foreground">{categorySuggestion.begruendung}</p>
              )}
            </>
          }
        />
      )}
    </div>
  )
}

export default function VorschlaegePage() {
  return (
    <Suspense fallback={null}>
      <VorschlaegePageContent />
    </Suspense>
  )
}
