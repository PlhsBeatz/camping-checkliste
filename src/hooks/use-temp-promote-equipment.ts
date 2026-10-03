'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import type { Category, MainCategory, Mitreisender, Tag, TagKategorie, TransportVehicle } from '@/lib/db'
import type { SmartSuggestion } from '@/lib/smart-suggestions'
import type { TempPromotePrefillHint } from '@/lib/temp-promote-prefill'
import type { CategorySelectScrollTarget } from '@/components/category-select-grouped'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useCategorySuggestion } from '@/hooks/use-category-suggestion'
import { showQueuedToast } from '@/lib/offline-toast'
import { postSmartSuggestionAction } from '@/lib/smart-suggestion-client'
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
import {
  buildEquipmentApiPayload,
  buildTagGroupsForEquipment,
  createDefaultEquipmentFormValues,
  getEquipmentFormValidationError,
  mitreisendenZeileAusApi,
  type EquipmentFormValues,
  type MitreisendenZeile,
} from '@/lib/equipment-form'

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

export type TempPromoteEquipmentDialogState = {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestion: SmartSuggestion | null
  form: EquipmentFormValues
  setForm: (next: EquipmentFormValues) => void
  hints: TempPromotePrefillHint[]
  categories: CategoryWithMain[]
  mainCategories: MainCategory[]
  transportVehicles: TransportVehicle[]
  tagGroups: ReturnType<typeof buildTagGroupsForEquipment>
  mitreisende: MitreisendenZeile[]
  individuelleMitreisendeExtraOpen: boolean
  setIndividuelleMitreisendeExtraOpen: (open: boolean) => void
  categorySelectScrollTarget: CategorySelectScrollTarget | null
  replaceTempInFuturePacklists: boolean
  setReplaceTempInFuturePacklists: (checked: boolean) => void
  categorySuggestion: ReturnType<typeof useCategorySuggestion>['suggestion']
  categoryLoading: boolean
  isSaving: boolean
  onSave: () => Promise<void>
}

/**
 * Gemeinsamer Flow „temporärer Packlisteneintrag → Ausrüstung anlegen“.
 * Katalog und Prefill erst beim Öffnen – spart Worker-/Netzlast auf Hub und Inbox.
 */
export function useTempPromoteEquipment(opts?: {
  onCompleted?: () => void | Promise<void>
}) {
  const { mutate } = useOptimisticMutation()
  const onCompleted = opts?.onCompleted

  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null)
  const [form, setForm] = useState<EquipmentFormValues>(createDefaultEquipmentFormValues())
  const [hints, setHints] = useState<TempPromotePrefillHint[]>([])
  const [opening, setOpening] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [replaceTempInFuturePacklists, setReplaceTempInFuturePacklists] = useState(true)
  const [individuelleMitreisendeExtraOpen, setIndividuelleMitreisendeExtraOpen] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<CategorySelectScrollTarget | null>(null)

  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])
  const [mitreisende, setMitreisende] = useState<MitreisendenZeile[]>([])
  const catalogReadyRef = useRef(false)
  const catalogLoadPromiseRef = useRef<Promise<void> | null>(null)

  const open = Boolean(suggestion)
  const { suggestion: categorySuggestion, loading: categoryLoading } = useCategorySuggestion(
    form.was,
    open
  )

  useEffect(() => {
    if (!open || !categorySuggestion || form.kategorie_id) return
    setForm((prev) =>
      prev.kategorie_id ? prev : { ...prev, kategorie_id: categorySuggestion.kategorie_id }
    )
  }, [open, categorySuggestion, form.kategorie_id])

  const tagGroups = useMemo(
    () => buildTagGroupsForEquipment(tagKategorien, tags),
    [tagKategorien, tags]
  )

  const ensureEquipmentCatalog = useCallback(async () => {
    if (catalogReadyRef.current) return
    if (catalogLoadPromiseRef.current) {
      await catalogLoadPromiseRef.current
      return
    }

    const loadPromise = (async () => {
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
      catalogReadyRef.current = true
    })()

    catalogLoadPromiseRef.current = loadPromise
    try {
      await loadPromise
    } finally {
      catalogLoadPromiseRef.current = null
    }
  }, [])

  const close = useCallback((nextOpen: boolean) => {
    if (nextOpen) return
    setSuggestion(null)
    setHints([])
    setScrollTarget(null)
    setIndividuelleMitreisendeExtraOpen(false)
    setReplaceTempInFuturePacklists(true)
    setForm(createDefaultEquipmentFormValues())
  }, [])

  const openForSuggestion = useCallback(
    async (next: SmartSuggestion): Promise<boolean> => {
      const was = String(next.payload.was ?? '').trim()
      const kategorieId = String(next.payload.kategorie_id ?? '').trim()
      if (!was || !kategorieId) {
        alert('Vorschlag unvollständig – Name oder Kategorie fehlt.')
        return false
      }

      setOpening(true)
      setOpeningId(next.id)
      setIndividuelleMitreisendeExtraOpen(false)
      setReplaceTempInFuturePacklists(true)

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

        setForm(nextForm)
        setHints(nextHints)
        setScrollTarget(
          nextForm.kategorie_id
            ? { kind: 'categoryRow', categoryId: nextForm.kategorie_id }
            : null
        )
        setSuggestion(next)
        return true
      } catch (error) {
        console.error('temp-promote prefill failed:', error)
        setForm({
          ...createDefaultEquipmentFormValues(was),
          kategorie_id: kategorieId,
        })
        setHints([])
        setScrollTarget(
          kategorieId ? { kind: 'categoryRow', categoryId: kategorieId } : null
        )
        setSuggestion(next)
        return true
      } finally {
        setOpening(false)
        setOpeningId(null)
      }
    },
    [ensureEquipmentCatalog]
  )

  const openForSuggestionId = useCallback(
    async (id: string): Promise<boolean> => {
      setOpening(true)
      setOpeningId(id)
      let handedOff = false
      try {
        const res = await fetch(`/api/suggestions?id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as ApiResponse<SmartSuggestion[]>
        const one = json.success && json.data?.[0] ? json.data[0] : null
        if (!one || one.kind !== 'temp_promote') {
          alert(json.error || 'Vorschlag nicht gefunden.')
          return false
        }
        handedOff = true
        return await openForSuggestion(one)
      } catch (error) {
        console.error('temp-promote load failed:', error)
        alert('Vorschlag konnte nicht geladen werden.')
        return false
      } finally {
        if (!handedOff) {
          setOpening(false)
          setOpeningId(null)
        }
      }
    },
    [openForSuggestion]
  )

  const save = useCallback(async () => {
    if (!suggestion) return
    const validationError = getEquipmentFormValidationError(form)
    if (validationError) {
      alert(validationError)
      return
    }

    const matchWas = String(suggestion.payload.was ?? form.was).trim()
    const matchKat = String(suggestion.payload.kategorie_id ?? form.kategorie_id).trim()

    setSaving(true)
    try {
      const clientId = crypto.randomUUID()
      const result = await mutate({
        table: 'equipment-items',
        action: 'post',
        key: clientId,
        payload: {
          id: clientId,
          ...buildEquipmentApiPayload(form),
          replace_temp_in_future_packlists: replaceTempInFuturePacklists,
          temp_match_was: matchWas,
          temp_match_kategorie_id: matchKat,
        },
      })
      if (!result.ok && !result.queued) {
        alert('Fehler beim Speichern' + (result.error ? `: ${result.error}` : ''))
        return
      }
      if (result.queued) {
        showQueuedToast()
      }
      notifyEquipmentChanged()

      const accept = await postSmartSuggestionAction(suggestion.id, 'accept')
      if (!accept.ok) {
        alert(
          accept.error ||
            'Ausrüstung gespeichert, aber Vorschlag konnte nicht als erledigt markiert werden.'
        )
      }
      close(false)
      await onCompleted?.()
    } catch (error) {
      console.error('Failed to save equipment from temp_promote:', error)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }, [suggestion, form, replaceTempInFuturePacklists, mutate, close, onCompleted])

  const dialogState: TempPromoteEquipmentDialogState = {
    open,
    onOpenChange: close,
    suggestion,
    form,
    setForm,
    hints,
    categories,
    mainCategories,
    transportVehicles,
    tagGroups,
    mitreisende,
    individuelleMitreisendeExtraOpen,
    setIndividuelleMitreisendeExtraOpen,
    categorySelectScrollTarget: scrollTarget,
    replaceTempInFuturePacklists,
    setReplaceTempInFuturePacklists,
    categorySuggestion,
    categoryLoading,
    isSaving: saving,
    onSave: save,
  }

  return {
    opening,
    openingId,
    openForSuggestion,
    openForSuggestionId,
    dialogState,
  }
}
