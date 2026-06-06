import type { D1Database } from '@cloudflare/workers-types'
import { getVacation, getPackingItems, getVacations, getDB, type CloudflareEnv } from '@/lib/db'
import {
  getIntegrationVacationState,
  upsertIntegrationVacationState,
  type IntegrationEventType,
} from '@/lib/integration-db'
import { addCalendarDays, normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import {
  buildTripStatusPayload,
  PROGRESS_THRESHOLDS,
  type TripPhase,
} from '@/lib/trip-readiness'
import { buildCloudEvent, deliverEventToAllWebhooks } from '@/lib/webhooks'

const DEPARTURE_APPROACHING_DAYS = [3, 1] as const

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
  payload: ReturnType<typeof buildTripStatusPayload>,
  prev: Awaited<ReturnType<typeof getIntegrationVacationState>>,
  flags: StateFlags,
  lastProgressEventPercent: number | null
) {
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
  }
}

function collectPackingEvents(
  prev: Awaited<ReturnType<typeof getIntegrationVacationState>>,
  payload: ReturnType<typeof buildTripStatusPayload>
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
  prev: Awaited<ReturnType<typeof getIntegrationVacationState>>,
  payload: ReturnType<typeof buildTripStatusPayload>,
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

export async function processIntegrationEventsForVacation(
  db: D1Database,
  vacationId: string,
  options: { cronMode?: boolean } = {}
): Promise<void> {
  const vacation = await getVacation(db, vacationId)
  if (!vacation) return

  const items = await getPackingItems(db, vacationId)
  const payload = buildTripStatusPayload(vacation, items)
  const prev = await getIntegrationVacationState(db, vacationId)

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
    buildNextState(vacationId, payload, prev, flags, lastProgressEventPercent)
  )

  for (const eventType of allEvents) {
    const event = buildCloudEvent(eventType, vacationId, payload)
    await deliverEventToAllWebhooks(db, event)
  }
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
  vacationId: string
): Promise<void> {
  try {
    const db = await getDB(env)
    await processIntegrationEventsForVacation(db, vacationId)
  } catch (err) {
    console.warn('notifyIntegrationChange failed:', err)
  }
}
