import type { D1Database } from '@cloudflare/workers-types'
import {
  getVacation,
  getPackingItemsForHub,
  getVacations,
  getDB,
  type CloudflareEnv,
} from '@/lib/db'
import {
  applyIntegrationPackingDelta,
  getEnabledIntegrationWebhooks,
  getIntegrationVacationState,
  upsertIntegrationVacationState,
  type IntegrationEventType,
  type IntegrationVacationStateRow,
} from '@/lib/integration-db'
import { addCalendarDays, normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import {
  buildTripStatusPayload,
  buildTripStatusPayloadFromProgress,
  PROGRESS_THRESHOLDS,
  type TripPhase,
  type TripStatusPayload,
} from '@/lib/trip-readiness'
import { buildCloudEvent, deliverEventToAllWebhooks } from '@/lib/webhooks'
import {
  clearIntegrationDebounce,
  scheduleIntegrationDebounce,
} from '@/lib/packing-sync'

const DEPARTURE_APPROACHING_DAYS = [3, 1] as const

export type NotifyIntegrationOptions = {
  /**
   * Änderung der zählbaren „gepackt“-Slots (±1 pro Person/Gruppe/Pauschal-Item).
   * Ermöglicht Update ohne Full-Scan. Vorgemerkt-Toggles: weglassen oder 0.
   */
  packedDelta?: number
}

function crossedProgressThreshold(
  prevPercent: number,
  nextPercent: number,
  lastEventPercent: number | null
): boolean {
  if (Math.abs(nextPercent - prevPercent) >= 5) return true
  for (const t of PROGRESS_THRESHOLDS) {
    if (prevPercent < t && nextPercent >= t) {
      if (lastEventPercent == null || lastEventPercent < t) return true
    }
  }
  return false
}

type StateFlags = {
  departure_approaching_sent: number
  departure_day_sent: number
  trip_started_sent: number
  trip_ended_sent: number
}

function buildNextState(
  vacationId: string,
  payload: TripStatusPayload,
  flags: StateFlags,
  lastProgressEventPercent: number | null
): Omit<IntegrationVacationStateRow, 'updated_at'> {
  return {
    vacation_id: vacationId,
    percent: payload.packing.percent,
    complete: payload.packing.complete ? 1 : 0,
    phase: payload.phase,
    last_progress_event_percent: lastProgressEventPercent,
    departure_approaching_sent: flags.departure_approaching_sent,
    departure_day_sent: flags.departure_day_sent,
    trip_started_sent: flags.trip_started_sent,
    trip_ended_sent: flags.trip_ended_sent,
    packed: payload.packing.packed,
    total: payload.packing.total,
  }
}

function collectPackingEvents(
  prev: IntegrationVacationStateRow | null,
  payload: TripStatusPayload
): { events: IntegrationEventType[]; lastProgressEventPercent: number | null } {
  const events: IntegrationEventType[] = []
  let lastProgressEventPercent = prev?.last_progress_event_percent ?? null

  const prevComplete = !!prev?.complete
  const nextComplete = payload.packing.complete
  const prevPercent = prev?.percent ?? 0
  const nextPercent = payload.packing.percent

  if (!prevComplete && nextComplete) {
    events.push('de.camping-packliste.packing.complete')
  } else if (prevComplete && !nextComplete) {
    events.push('de.camping-packliste.packing.incomplete')
  }

  if (
    crossedProgressThreshold(prevPercent, nextPercent, lastProgressEventPercent) &&
    !events.includes('de.camping-packliste.packing.complete')
  ) {
    events.push('de.camping-packliste.packing.progress_changed')
    lastProgressEventPercent = nextPercent
  }

  return { events, lastProgressEventPercent }
}

function collectPhaseEvents(
  prev: IntegrationVacationStateRow | null,
  payload: TripStatusPayload,
  flags: StateFlags,
  cronMode: boolean
): IntegrationEventType[] {
  const events: IntegrationEventType[] = []
  const prevPhase = (prev?.phase ?? 'planning') as TripPhase

  if (cronMode) {
    if (
      payload.phase === 'departure_approaching' &&
      DEPARTURE_APPROACHING_DAYS.includes(payload.days_until_departure as 1 | 3) &&
      !flags.departure_approaching_sent
    ) {
      events.push('de.camping-packliste.trip.departure_approaching')
      flags.departure_approaching_sent = 1
    }
    if (payload.phase === 'departure_day' && !flags.departure_day_sent) {
      events.push('de.camping-packliste.trip.departure_day')
      flags.departure_day_sent = 1
    }
    if (payload.phase === 'returned' && !flags.trip_ended_sent) {
      events.push('de.camping-packliste.trip.ended')
      flags.trip_ended_sent = 1
    }
  }

  if (
    (payload.phase === 'on_trip' || payload.phase === 'departure_day') &&
    prevPhase !== 'on_trip' &&
    prevPhase !== 'departure_day' &&
    !flags.trip_started_sent
  ) {
    events.push('de.camping-packliste.trip.started')
    flags.trip_started_sent = 1
  }

  return events
}

async function emitEventsForPayload(
  db: D1Database,
  vacationId: string,
  payload: TripStatusPayload,
  prev: IntegrationVacationStateRow | null,
  options: { cronMode?: boolean } = {}
): Promise<void> {
  const flags: StateFlags = {
    departure_approaching_sent: prev?.departure_approaching_sent ?? 0,
    departure_day_sent: prev?.departure_day_sent ?? 0,
    trip_started_sent: prev?.trip_started_sent ?? 0,
    trip_ended_sent: prev?.trip_ended_sent ?? 0,
  }

  const { events: packingEvents, lastProgressEventPercent } = collectPackingEvents(prev, payload)
  const phaseEvents = collectPhaseEvents(prev, payload, flags, !!options.cronMode)
  const allEvents = [...packingEvents, ...phaseEvents]

  await upsertIntegrationVacationState(
    db,
    buildNextState(vacationId, payload, flags, lastProgressEventPercent)
  )

  for (const eventType of allEvents) {
    const event = buildCloudEvent(eventType, vacationId, payload)
    await deliverEventToAllWebhooks(db, event)
  }
}

/**
 * Voller Recount über Hub-Query (leichter als getPackingItems).
 * Setzt packed/total für spätere Deltas.
 */
async function processIntegrationFullRecount(
  db: D1Database,
  vacationId: string,
  options: { cronMode?: boolean } = {}
): Promise<void> {
  const vacation = await getVacation(db, vacationId)
  if (!vacation) return

  const items = await getPackingItemsForHub(db, vacationId)
  const payload = buildTripStatusPayload(vacation, items)
  const prev = await getIntegrationVacationState(db, vacationId)
  await emitEventsForPayload(db, vacationId, payload, prev, options)
}

/**
 * Schneller Pfad: nur Zähler atomar anpassen (kein Packlisten-Scan).
 * Fallback auf Full-Recount wenn noch keine Zähler existieren.
 */
async function processIntegrationDelta(
  db: D1Database,
  vacationId: string,
  packedDelta: number
): Promise<void> {
  if (packedDelta === 0) return

  const prevBefore = await getIntegrationVacationState(db, vacationId)
  if (
    !prevBefore ||
    prevBefore.total == null ||
    prevBefore.total <= 0 ||
    prevBefore.packed == null
  ) {
    await processIntegrationFullRecount(db, vacationId)
    return
  }

  const updated = await applyIntegrationPackingDelta(db, vacationId, packedDelta)
  if (!updated || updated.total == null || updated.packed == null) {
    await processIntegrationFullRecount(db, vacationId)
    return
  }

  const vacation = await getVacation(db, vacationId)
  if (!vacation) return

  const open_items_count = Math.max(0, updated.total - updated.packed)
  const payload = buildTripStatusPayloadFromProgress(vacation, {
    percent: updated.percent,
    complete: !!updated.complete,
    packed: updated.packed,
    total: updated.total,
    open_items_count,
  })

  // applyIntegrationPackingDelta hat percent/complete/packed schon geschrieben;
  // emitEvents aktualisiert phase/flags und liefert Webhooks.
  await emitEventsForPayload(db, vacationId, payload, prevBefore)
}

export async function processIntegrationEventsForVacation(
  db: D1Database,
  vacationId: string,
  options: { cronMode?: boolean; packedDelta?: number; skipWebhookCheck?: boolean } = {}
): Promise<void> {
  // Ohne Webhooks und außerhalb Cron: kein D1-Aufwand für Trip-Status-Events
  if (!options.cronMode && !options.skipWebhookCheck) {
    const webhooks = await getEnabledIntegrationWebhooks(db)
    if (webhooks.length === 0) return
  }

  // Netto-Null nach Debounce: nichts tun (kein Full-Recount)
  if (!options.cronMode && options.packedDelta === 0) return

  if (!options.cronMode && options.packedDelta != null) {
    await processIntegrationDelta(db, vacationId, options.packedDelta)
    return
  }

  await processIntegrationFullRecount(db, vacationId, options)
}

export async function processIntegrationCron(db: D1Database): Promise<number> {
  const vacations = await getVacations(db)
  const cutoff = addCalendarDays(todayInAppTimezone(), -14)

  let processed = 0
  for (const v of vacations) {
    const end = normalizeCalendarDate(v.enddatum)
    if (end < cutoff) continue

    await processIntegrationEventsForVacation(db, v.id, { cronMode: true })
    processed += 1
  }
  return processed
}

export async function notifyIntegrationChange(
  env: CloudflareEnv,
  vacationId: string,
  options: NotifyIntegrationOptions = {}
): Promise<void> {
  try {
    // Vorgemerkt ändert den Integrations-Fortschritt nicht
    if (options.packedDelta === 0) return

    const db = await getDB(env)

    // Früher Abbruch ohne Webhooks (auch vor Debounce-Schedule)
    const webhooks = await getEnabledIntegrationWebhooks(db)
    if (webhooks.length === 0) return

    // Toggle-Deltas: im DO bündeln (10 s Ruhe / max. 30 s)
    if (options.packedDelta != null) {
      const scheduled = await scheduleIntegrationDebounce(
        env,
        vacationId,
        options.packedDelta
      )
      if (!scheduled) {
        await processIntegrationEventsForVacation(db, vacationId, {
          packedDelta: options.packedDelta,
          skipWebhookCheck: true,
        })
      }
      return
    }

    // Strukturänderung: Pending verwerfen, sofort Full-Recount
    await clearIntegrationDebounce(env, vacationId)
    await processIntegrationEventsForVacation(db, vacationId, {
      skipWebhookCheck: true,
    })
  } catch (err) {
    console.warn('notifyIntegrationChange failed:', err)
  }
}
