'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import type {
  VerbrauchEreignis,
  VerbrauchMedium,
  VerbrauchMessung,
  Vacation,
} from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { formatVerbrauchMitEinheit, verbrauchDifferenz } from '@/lib/verbrauch-format'
import { supportsGewichtZuLiter } from '@/lib/verbrauch-medien-katalog'
import { normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import {
  ChevronDown,
  Fuel,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Flag,
  CircleDot,
  AlertTriangle,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { VerbrauchChart } from '@/components/verbrauch/verbrauch-chart'
import { GewichtZuLiterEingabe } from '@/components/verbrauch/gewicht-zu-liter-eingabe'
import { cn } from '@/lib/utils'
import {
  computeVerbrauchRateStats,
  evaluateReichweite,
  plannedTempForVacation,
  reichweiteReiseTage,
} from '@/lib/verbrauch-reichweite'

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

function isComplete(m: VerbrauchMessung): boolean {
  return m.wert_start != null && m.wert_ende != null
}

/** Endstand erst am letzten Urlaubstag oder danach. */
function canEnterEndstand(
  vacation: Vacation | undefined,
  messung: VerbrauchMessung
): boolean {
  const endRaw = vacation?.enddatum?.trim() || messung.messdatum_ende
  if (!endRaw) return false
  const endYmd = normalizeCalendarDate(endRaw)
  const today = todayInAppTimezone()
  return endYmd <= today
}

/** Vergangene/laufende Urlaube ohne Messung + höchstens der nächste Zukunfts-Urlaub
 * (nur wenn für diesen noch keine Messung existiert; sonst kein Zukunfts-Vorschlag). */
function vacationsForAnfangsstand(
  vacations: Vacation[],
  usedUrlaubIds: Set<string>
): { selectable: Vacation[]; nextFuture: Vacation | null } {
  const today = todayInAppTimezone()
  const sorted = vacations.slice().sort((a, b) =>
    normalizeCalendarDate(a.startdatum).localeCompare(normalizeCalendarDate(b.startdatum))
  )

  const pastOrCurrentUnused = sorted.filter(
    (v) =>
      normalizeCalendarDate(v.startdatum) <= today && !usedUrlaubIds.has(v.id)
  )

  // Nächster Zukunfts-Urlaub global – nicht der nächste ohne Messung
  const nextFutureOverall =
    sorted.find((v) => normalizeCalendarDate(v.startdatum) > today) ?? null

  const nextFuture =
    nextFutureOverall && !usedUrlaubIds.has(nextFutureOverall.id)
      ? nextFutureOverall
      : null

  return {
    selectable: (nextFuture ? [...pastOrCurrentUnused, nextFuture] : pastOrCurrentUnused)
      .slice()
      .sort((a, b) =>
        normalizeCalendarDate(b.startdatum).localeCompare(normalizeCalendarDate(a.startdatum))
      ),
    nextFuture,
  }
}

type DialogMode =
  | { kind: 'start' }
  | { kind: 'ende'; messung: VerbrauchMessung }
  | { kind: 'auffuellung'; messung: VerbrauchMessung; ereignis?: VerbrauchEreignis }
  | { kind: 'edit'; messung: VerbrauchMessung }

export function VerbrauchMessungSection({
  medium,
  messungen,
  vacations,
  canAdmin,
  onMessungCreated,
  onMessungUpdated,
  onMessungDeleted,
  onRefresh,
}: {
  medium: VerbrauchMedium
  messungen: VerbrauchMessung[]
  vacations: Vacation[]
  canAdmin: boolean
  onMessungCreated: (item: VerbrauchMessung) => void
  onMessungUpdated: (item: VerbrauchMessung) => void
  onMessungDeleted: (id: string) => void
  onRefresh: () => void
}) {
  const supportsAuffuellung = medium.messmodus === 'abnahme'
  const showGewichtHilfe = supportsGewichtZuLiter(medium)

  const [dialog, setDialog] = useState<DialogMode | null>(null)
  const [urlaubId, setUrlaubId] = useState('')
  const [wert, setWert] = useState('')
  const [menge, setMenge] = useState('')
  const [datum, setDatum] = useState('')
  const [notizen, setNotizen] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteMessungId, setDeleteMessungId] = useState<string | null>(null)
  const [deleteEreignis, setDeleteEreignis] = useState<{
    messungId: string
    ereignisId: string
  } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(
    () =>
      messungen
        .filter((m) => m.typ === medium.schluessel)
        .slice()
        .sort((a, b) => {
          const da = a.messdatum_ende || a.messdatum_start || a.created_at
          const db = b.messdatum_ende || b.messdatum_start || b.created_at
          return db.localeCompare(da)
        }),
    [messungen, medium.schluessel]
  )

  const newestId = filtered[0]?.id ?? null

  // Nur beim Medium-Wechsel zurücksetzen – aufgeklappte Urlaube bleiben sonst offen
  useEffect(() => {
    setExpandedIds(newestId ? new Set([newestId]) : new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei Medium-Wechsel
  }, [medium.schluessel])

  const suggestedStart = useMemo(() => {
    const completed = filtered
      .filter((m) => isComplete(m))
      .slice()
      .sort((a, b) =>
        (b.messdatum_ende || b.created_at || '').localeCompare(
          a.messdatum_ende || a.created_at || ''
        )
      )
    return completed[0]?.wert_ende ?? null
  }, [filtered])

  const usedUrlaubIds = useMemo(
    () => new Set(filtered.map((m) => m.urlaub_id).filter(Boolean) as string[]),
    [filtered]
  )

  const { selectable: availableVacations, nextFuture: nextFutureVacation } = useMemo(
    () => vacationsForAnfangsstand(vacations, usedUrlaubIds),
    [vacations, usedUrlaubIds]
  )

  const openDialog = (mode: DialogMode) => {
    setDialog(mode)
    setNotizen('')
    setDatum('')
    setMenge('')
    setWert('')
    setUrlaubId('')

    if (mode.kind === 'start') {
      if (nextFutureVacation) {
        setUrlaubId(nextFutureVacation.id)
        setWert(suggestedStart != null ? String(suggestedStart) : '')
      }
    } else if (mode.kind === 'ende') {
      setWert('')
      setNotizen(mode.messung.notizen ?? '')
    } else if (mode.kind === 'auffuellung') {
      if (mode.ereignis) {
        setMenge(String(mode.ereignis.menge))
        setDatum(mode.ereignis.datum?.slice(0, 10) ?? '')
        setNotizen(mode.ereignis.notizen ?? '')
      } else {
        setDatum(new Date().toISOString().slice(0, 10))
      }
    } else if (mode.kind === 'edit') {
      setUrlaubId(mode.messung.urlaub_id ?? '')
      setWert(mode.messung.wert_start != null ? String(mode.messung.wert_start) : '')
      setMenge(mode.messung.wert_ende != null ? String(mode.messung.wert_ende) : '')
      setNotizen(mode.messung.notizen ?? '')
    }
  }

  const onAnfangsstandUrlaubChange = (id: string) => {
    setUrlaubId(id)
    if (nextFutureVacation && id === nextFutureVacation.id && suggestedStart != null) {
      setWert(String(suggestedStart))
    } else {
      setWert('')
    }
  }

  useEffect(() => {
    setDialog(null)
  }, [medium.schluessel])

  const selectedVacation = vacations.find((v) => v.id === urlaubId)

  const anfangsstandReichweite = useMemo(() => {
    if (dialog?.kind !== 'start' || !selectedVacation) return null
    const verfuegbar = Number(String(wert).replace(',', '.'))
    if (!Number.isFinite(verfuegbar) || wert.trim() === '') return null
    const plannedTempC = plannedTempForVacation({
      startdatum: selectedVacation.startdatum,
      enddatum: selectedVacation.enddatum || selectedVacation.startdatum,
      lat: null,
    })
    const stats = computeVerbrauchRateStats(medium, messungen, { plannedTempC })
    return evaluateReichweite({
      medium,
      verfuegbar,
      days: reichweiteReiseTage(selectedVacation),
      stats,
    })
  }, [dialog?.kind, selectedVacation, wert, medium, messungen])

  const showAnfangsstandWarnung =
    anfangsstandReichweite != null &&
    (anfangsstandReichweite.ampel === 'eng' || anfangsstandReichweite.ampel === 'kritisch')

  const isNextFutureSelected =
    !!nextFutureVacation && urlaubId === nextFutureVacation.id

  const editEndstandAllowed = useMemo(() => {
    if (dialog?.kind !== 'edit') return true
    if (dialog.messung.wert_ende != null) return true
    const editVac = vacations.find((v) => v.id === urlaubId)
    return canEnterEndstand(editVac, {
      ...dialog.messung,
      urlaub_id: urlaubId || dialog.messung.urlaub_id,
      messdatum_ende: editVac?.enddatum ?? dialog.messung.messdatum_ende,
    })
  }, [dialog, urlaubId, vacations])

  const handleSubmit = async () => {
    if (!dialog) return
    setSaving(true)
    try {
      if (dialog.kind === 'start') {
        if (!urlaubId || !wert) return
        const res = await fetch('/api/verbrauch-messungen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            typ: medium.schluessel,
            urlaub_id: urlaubId,
            messdatum_start: selectedVacation?.startdatum ?? null,
            messdatum_ende: selectedVacation?.enddatum ?? null,
            wert_start: Number(wert),
            wert_ende: null,
            einheit: medium.einheit,
            notizen: notizen || null,
          }),
        })
        const data = (await res.json()) as ApiResponse<VerbrauchMessung>
        if (res.ok && data.success && data.data) {
          onMessungCreated(data.data)
          setExpandedIds((prev) => new Set(prev).add(data.data!.id))
          setDialog(null)
        } else onRefresh()
      } else if (dialog.kind === 'ende') {
        if (!wert) return
        const vacation = vacations.find((v) => v.id === dialog.messung.urlaub_id)
        if (!canEnterEndstand(vacation, dialog.messung)) return
        const res = await fetch(`/api/verbrauch-messungen/${dialog.messung.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wert_ende: Number(wert),
            messdatum_ende: vacation?.enddatum ?? dialog.messung.messdatum_ende,
            notizen: notizen.trim() || dialog.messung.notizen,
          }),
        })
        const data = (await res.json()) as ApiResponse<VerbrauchMessung>
        if (res.ok && data.success && data.data) {
          onMessungUpdated(data.data)
          setDialog(null)
        } else onRefresh()
      } else if (dialog.kind === 'auffuellung') {
        if (!menge || !(Number(menge) > 0)) return
        if (dialog.ereignis) {
          const res = await fetch(
            `/api/verbrauch-messungen/${dialog.messung.id}/ereignisse/${dialog.ereignis.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                menge: Number(menge),
                datum: datum || null,
                notizen: notizen || null,
              }),
            }
          )
          const data = (await res.json()) as ApiResponse<{ messung: VerbrauchMessung }>
          if (res.ok && data.success && data.data?.messung) {
            onMessungUpdated(data.data.messung)
            setDialog(null)
          } else onRefresh()
        } else {
          const res = await fetch(
            `/api/verbrauch-messungen/${dialog.messung.id}/ereignisse`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                menge: Number(menge),
                datum: datum || null,
                notizen: notizen || null,
              }),
            }
          )
          const data = (await res.json()) as ApiResponse<{ messung: VerbrauchMessung }>
          if (res.ok && data.success && data.data?.messung) {
            onMessungUpdated(data.data.messung)
            setDialog(null)
          } else onRefresh()
        }
      } else if (dialog.kind === 'edit') {
        const vacation = vacations.find((v) => v.id === urlaubId)
        const endRef: VerbrauchMessung = {
          ...dialog.messung,
          urlaub_id: urlaubId || dialog.messung.urlaub_id,
          messdatum_ende: vacation?.enddatum ?? dialog.messung.messdatum_ende,
        }
        const endAllowed =
          dialog.messung.wert_ende != null || canEnterEndstand(vacation, endRef)
        const wertEnde =
          menge === ''
            ? null
            : endAllowed
              ? Number(menge)
              : dialog.messung.wert_ende
        const res = await fetch(`/api/verbrauch-messungen/${dialog.messung.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urlaub_id: urlaubId || null,
            messdatum_start: vacation?.startdatum ?? dialog.messung.messdatum_start,
            messdatum_ende: vacation?.enddatum ?? dialog.messung.messdatum_ende,
            wert_start: wert === '' ? null : Number(wert),
            wert_ende: wertEnde,
            notizen: notizen.trim() || null,
          }),
        })
        const data = (await res.json()) as ApiResponse<VerbrauchMessung>
        if (res.ok && data.success && data.data) {
          onMessungUpdated(data.data)
          setDialog(null)
        } else onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMessung = async () => {
    if (!deleteMessungId) return
    const id = deleteMessungId
    setDeleteMessungId(null)
    onMessungDeleted(id)
    try {
      const res = await fetch(`/api/verbrauch-messungen/${id}`, { method: 'DELETE' })
      if (!res.ok) onRefresh()
    } catch {
      onRefresh()
    }
  }

  const handleDeleteEreignis = async () => {
    if (!deleteEreignis) return
    const { messungId, ereignisId } = deleteEreignis
    setDeleteEreignis(null)
    try {
      const res = await fetch(
        `/api/verbrauch-messungen/${messungId}/ereignisse/${ereignisId}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as ApiResponse<{ messung: VerbrauchMessung }>
      if (res.ok && data.success && data.data?.messung) {
        onMessungUpdated(data.data.messung)
      } else onRefresh()
    } catch {
      onRefresh()
    }
  }

  const dialogTitle =
    dialog?.kind === 'start'
      ? 'Anfangsstand erfassen'
      : dialog?.kind === 'ende'
        ? 'Endstand erfassen'
        : dialog?.kind === 'auffuellung'
          ? dialog.ereignis
            ? 'Auffüllung bearbeiten'
            : 'Auffüllung / Kauf'
          : dialog?.kind === 'edit'
            ? 'Messung bearbeiten'
            : ''

  const dialogDescription =
    dialog?.kind === 'auffuellung' && !dialog.ereignis
      ? `z.\u00a0B. 11\u00a0${medium.einheit} ${medium.name} nachgekauft / aufgefüllt.`
      : dialog?.kind === 'start' &&
          isNextFutureSelected &&
          suggestedStart != null
        ? `Vorschlag: Endwert letzter Urlaub (${formatVerbrauchMitEinheit(suggestedStart, medium.einheit, 1)})`
        : undefined

  return (
    <div className="space-y-4 pb-20">
      <h2 className="text-base font-semibold text-brand-heading">{medium.name}</h2>

      <VerbrauchChart medium={medium} messungen={messungen} />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Noch keine Messung. Starte mit dem Wiegen/Messen vor der Abreise.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => {
            const complete = isComplete(m)
            const vacation = vacations.find((v) => v.id === m.urlaub_id)
            const endstandAllowed = canEnterEndstand(vacation, m)
            const auffuellungen =
              supportsAuffuellung ? (m.auffuellungen_summe ?? 0) : 0
            const gesamt =
              complete && m.wert_start != null && m.wert_ende != null
                ? verbrauchDifferenz(
                    m.wert_start,
                    m.wert_ende,
                    medium.messmodus,
                    auffuellungen
                  )
                : m.verbrauch_gesamt
            const ereignisse = m.ereignisse ?? []
            const expanded = expandedIds.has(m.id)

            return (
              <li
                key={m.id}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <div
                  className={cn(
                    'flex items-start justify-between gap-2 px-3 py-2.5 bg-muted/20',
                    expanded && 'border-b'
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(m.id)) next.delete(m.id)
                        else next.add(m.id)
                        return next
                      })
                    }
                    aria-expanded={expanded}
                  >
                    <p className="font-medium truncate flex items-center gap-1.5">
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          !expanded && '-rotate-90'
                        )}
                      />
                      <span className="truncate">{m.urlaub_titel ?? 'Ohne Urlaub'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground pl-[22px]">
                      {formatDate(m.messdatum_start)} – {formatDate(m.messdatum_ende)}
                      {complete ? (
                        <span className="ml-2 text-foreground">
                          · {formatVerbrauchMitEinheit(gesamt, medium.einheit, 1)}
                          {m.verbrauch_pro_tag != null && (
                            <>
                              {' '}
                              ({formatVerbrauchMitEinheit(m.verbrauch_pro_tag, medium.einheit, 2)}
                              /Tag)
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="ml-2 text-[rgb(230,126,34)] font-medium">· Offen</span>
                      )}
                    </p>
                  </button>
                  {canAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openDialog({ kind: 'edit', messung: m })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        {!complete && endstandAllowed && (
                          <DropdownMenuItem
                            onSelect={() => openDialog({ kind: 'ende', messung: m })}
                          >
                            <Flag className="h-4 w-4 mr-2" />
                            Ende erfassen
                          </DropdownMenuItem>
                        )}
                        {supportsAuffuellung && (
                          <DropdownMenuItem
                            onSelect={() => openDialog({ kind: 'auffuellung', messung: m })}
                          >
                            <Fuel className="h-4 w-4 mr-2" />
                            Auffüllung
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => setDeleteMessungId(m.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {expanded && (
                <div className="border-t border-border/60">
                  {m.notizen?.trim() ? (
                    <p className="px-3 pt-2.5 text-sm text-foreground/90 whitespace-pre-wrap break-words leading-snug">
                      {m.notizen.trim()}
                    </p>
                  ) : null}
                <ol className="relative px-3 py-3 space-y-0">
                  <TimelineRow
                    icon={<CircleDot className="h-3.5 w-3.5" />}
                    label="Start"
                    value={
                      m.wert_start != null
                        ? formatVerbrauchMitEinheit(m.wert_start, medium.einheit, 1)
                        : '—'
                    }
                    meta={formatDate(m.messdatum_start)}
                    isLast={ereignisse.length === 0 && complete}
                  />

                  {ereignisse.map((e, idx) => (
                    <TimelineRow
                      key={e.id}
                      icon={<Fuel className="h-3.5 w-3.5" />}
                      label="Auffüllung"
                      value={`+${formatVerbrauchMitEinheit(e.menge, medium.einheit, 1)}`}
                      meta={formatDate(e.datum)}
                      note={e.notizen?.trim() || undefined}
                      accent
                      isLast={idx === ereignisse.length - 1 && complete}
                      menu={
                        canAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  openDialog({ kind: 'auffuellung', messung: m, ereignis: e })
                                }
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setDeleteEreignis({ messungId: m.id, ereignisId: e.id })
                                }
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : undefined
                      }
                    />
                  ))}

                  {complete ? (
                    <TimelineRow
                      icon={<Flag className="h-3.5 w-3.5" />}
                      label="Ende"
                      value={
                        m.wert_ende != null
                          ? formatVerbrauchMitEinheit(m.wert_ende, medium.einheit, 1)
                          : '—'
                      }
                      meta={formatDate(m.messdatum_ende)}
                      isLast
                    />
                  ) : (
                    <li className="flex items-center gap-3 pt-2 pl-0.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[rgb(230,126,34)] text-[rgb(230,126,34)]">
                        <Flag className="h-3 w-3" />
                      </span>
                      {canAdmin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {endstandAllowed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDialog({ kind: 'ende', messung: m })}
                            >
                              Ende erfassen
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Ende ab{' '}
                              {formatDate(vacation?.enddatum ?? m.messdatum_ende)}
                            </span>
                          )}
                          {supportsAuffuellung && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDialog({ kind: 'auffuellung', messung: m })}
                            >
                              <Fuel className="mr-1 h-3.5 w-3.5" />
                              Auffüllung
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {endstandAllowed
                            ? 'Ende ausstehend'
                            : `Ende ab ${formatDate(vacation?.enddatum ?? m.messdatum_ende)}`}
                        </span>
                      )}
                    </li>
                  )}
                </ol>
                </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ResponsiveModal
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialogTitle}
        description={dialogDescription}
        contentClassName="sm:max-w-sm"
      >
        <div className="space-y-3 pt-1">
            {dialog?.kind === 'start' && (
              <>
                <div className="space-y-1.5">
                  <Label>Urlaub</Label>
                  <Select value={urlaubId} onValueChange={onAnfangsstandUrlaubChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Urlaub wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVacations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.titel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {medium.label_wert_start} ({medium.einheit})
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={wert}
                    onChange={(e) => setWert(e.target.value)}
                    autoFocus
                  />
                </div>
                {showGewichtHilfe && medium.dichte_kg_pro_l != null && (
                  <GewichtZuLiterEingabe
                    key={`start-${medium.id}`}
                    dichteKgProL={medium.dichte_kg_pro_l}
                    defaultLeergewichtKg={medium.leergewicht_kg}
                    onUebernehmen={(liter) => setWert(String(liter))}
                  />
                )}
                {showAnfangsstandWarnung && anfangsstandReichweite && (
                  <div
                    className={cn(
                      'rounded-md border px-3 py-2 space-y-1',
                      anfangsstandReichweite.ampel === 'kritisch'
                        ? 'border-destructive/40 bg-destructive/5'
                        : 'border-amber-600/30 bg-amber-500/5'
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-medium flex items-start gap-1.5',
                        anfangsstandReichweite.ampel === 'kritisch'
                          ? 'text-destructive'
                          : 'text-amber-800 dark:text-amber-200'
                      )}
                    >
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{anfangsstandReichweite.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground pl-5">
                      {anfangsstandReichweite.reason}
                    </p>
                    {anfangsstandReichweite.risk ? (
                      <p className="text-xs text-destructive/80 pl-5">
                        {anfangsstandReichweite.risk}
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {dialog?.kind === 'ende' && (
              <>
                <div className="space-y-1.5">
                  <Label>
                    {medium.label_wert_ende} ({medium.einheit})
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={wert}
                    onChange={(e) => setWert(e.target.value)}
                    autoFocus
                  />
                </div>
                {showGewichtHilfe && medium.dichte_kg_pro_l != null && (
                  <GewichtZuLiterEingabe
                    key={`ende-${dialog.messung.id}`}
                    dichteKgProL={medium.dichte_kg_pro_l}
                    defaultLeergewichtKg={medium.leergewicht_kg}
                    onUebernehmen={(liter) => setWert(String(liter))}
                  />
                )}
              </>
            )}

            {dialog?.kind === 'auffuellung' && (
              <>
                <div className="space-y-1.5">
                  <Label>Menge ({medium.einheit})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={menge}
                    onChange={(e) => setMenge(e.target.value)}
                    placeholder={`z. B. 11 ${medium.einheit}`}
                    autoFocus
                  />
                </div>
                {showGewichtHilfe && medium.dichte_kg_pro_l != null && (
                  <GewichtZuLiterEingabe
                    key={`auff-${dialog.messung.id}-${dialog.ereignis?.id ?? 'new'}`}
                    dichteKgProL={medium.dichte_kg_pro_l}
                    defaultLeergewichtKg={medium.leergewicht_kg}
                    onUebernehmen={(liter) => setMenge(String(liter))}
                  />
                )}
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <CalendarDatePicker
                    value={datum}
                    onChange={setDatum}
                    dialogTitle="Auffülldatum"
                    placeholder="Datum wählen"
                  />
                </div>
              </>
            )}

            {dialog?.kind === 'edit' && (
              <>
                <div className="space-y-1.5">
                  <Label>Urlaub</Label>
                  <Select value={urlaubId} onValueChange={setUrlaubId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Urlaub wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {vacations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.titel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Start ({medium.einheit})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={wert}
                      onChange={(e) => setWert(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ende ({medium.einheit})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={menge}
                      onChange={(e) => setMenge(e.target.value)}
                      placeholder="optional"
                      disabled={!editEndstandAllowed}
                    />
                    {!editEndstandAllowed && (
                      <p className="text-xs text-muted-foreground">
                        Erst am letzten Urlaubstag oder danach.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Notiz</Label>
              <Input
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                placeholder="optional"
              />
            </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={
                saving ||
                (dialog?.kind === 'start' && (!urlaubId || !wert)) ||
                (dialog?.kind === 'ende' && !wert) ||
                (dialog?.kind === 'auffuellung' && (!menge || !(Number(menge) > 0)))
              }
            >
              Speichern
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteMessungId}
        onOpenChange={(o) => !o && setDeleteMessungId(null)}
        title="Messung löschen?"
        description="Die gesamte Timeline inkl. Auffüllungen wird gelöscht."
        onConfirm={() => void handleDeleteMessung()}
      />
      <ConfirmDialog
        open={!!deleteEreignis}
        onOpenChange={(o) => !o && setDeleteEreignis(null)}
        title="Auffüllung löschen?"
        description="Der Verbrauch wird neu berechnet."
        onConfirm={() => void handleDeleteEreignis()}
      />

      {canAdmin && availableVacations.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="icon"
            onClick={() => openDialog({ kind: 'start' })}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
            aria-label="Anfangsstand erfassen"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      )}
    </div>
  )
}

function TimelineRow({
  icon,
  label,
  value,
  meta,
  note,
  accent,
  isLast,
  menu,
}: {
  icon: ReactNode
  label: string
  value: string
  meta?: string
  note?: string
  accent?: boolean
  isLast?: boolean
  menu?: ReactNode
}) {
  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {!isLast && (
        <span
          className="absolute left-[11px] top-6 bottom-0 w-px bg-border"
          aria-hidden
        />
      )}
      <span
        className={cn(
          'relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border bg-card',
          accent
            ? 'border-[rgb(45,79,30)]/40 text-[rgb(45,79,30)]'
            : 'border-border text-muted-foreground'
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-medium tabular-nums break-all">{value}</span>
          </div>
          {meta ? (
            <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
          ) : null}
          {note ? (
            <p className="text-xs sm:text-sm text-foreground/85 mt-1 whitespace-pre-wrap break-words leading-snug">
              {note}
            </p>
          ) : null}
        </div>
        {menu}
      </div>
    </li>
  )
}
