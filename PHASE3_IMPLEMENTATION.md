# Phase 3: Offline + Echtzeit-Sync – Implementierung

## Übersicht

Phase 3 wurde umgesetzt mit **Option C** (Cloudflare-Stack bleibt):

- **Durable Objects** für Echtzeit-Sync der Packliste
- **IndexedDB (Dexie)** als Offline-Cache für Packlisten
- **transport_id** pro Packlisten-Eintrag (für Gewichtsberechnung)
- **Standardanzahl** und **Transport** aus Ausrüstung beim Hinzufügen übernommen

---

## 1. Durable Object (Packlisten-Sync)

- **Datei:** `src/durable-objects/PackingSyncDO.ts`
- **Worker:** `worker.ts` leitet WebSocket-Anfragen an `/api/packing-sync/ws?vacationId=...` an die DO weiter
- **Wrangler:** `wrangler.jsonc` – `main` → `worker.ts`, DO-Binding `PACKING_SYNC_DO`

**Flow:**
1. Client verbindet per WebSocket: `wss://<host>/api/packing-sync/ws?vacationId=<id>`
2. Bei Änderung (PUT/POST/DELETE) ruft die API `notifyPackingSyncChange(env, vacationId)` auf
3. DO broadcastet `{ type: 'packing-list-changed' }` an alle Clients
4. Clients laden die Packliste neu

---

## 2. IndexedDB (Offline-Cache)

- **Schema:** `src/lib/offline-db.ts` – Dexie mit Tabellen für alle D1-Entitäten + Sync-Queue
- **Packlisten:** Bei erfolgreicher API-Antwort wird der Cache aktualisiert
- **Offline:** Bei Netzwerkfehler werden gecachte Packlisten-Daten verwendet
- **Reconnect:** `subscribeToOnlineStatus` löst einen Refresh aus, sobald die App wieder online ist

---

## 3. Transport pro Packlisten-Eintrag

- **db.ts:** `updatePackingItem` unterstützt jetzt `transport_id`
- **API:** PUT `/api/packing-items` akzeptiert `transport_id`
- **UI:** Bearbeiten-Dialog enthält Auswahl für Transport (Auto/Wohnwagen)
- **Hinzufügen:** Verwendet `transport_id` und `standard_anzahl` aus der Ausrüstung

---

## 4. Anzahl pro Person/Mitreisender

- Verhalten unverändert: Bei `mitreisenden_typ` = `alle` oder `ausgewaehlte` wird die Anzahl pro Person interpretiert (bisherige Logik bleibt erhalten)

---

## 5. Neue/geänderte Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/durable-objects/PackingSyncDO.ts` | DO für WebSocket-Sync |
| `worker.ts` | Custom Worker mit DO und WebSocket-Weiterleitung |
| `src/lib/packing-sync.ts` | `notifyPackingSyncChange()` für API-Aufrufe |
| `src/lib/offline-db.ts` | Dexie-Schema und Cache-Funktionen |
| `src/lib/offline-sync.ts` | Cache lesen, Sync-Queue, Online-Status |
| `src/hooks/use-packing-sync.ts` | WebSocket-Hook für Packlisten |
| `src/hooks/use-offline-aware-fetch.ts` | (Optional) Hook für Offline-Packlisten |
| `wrangler.jsonc` | DO-Binding, Migrationen, `main` → `worker.ts` |

---

## 6. Deployment

1. **Build:** `pnpm run build:worker` (erzeugt `.open-next/`)
2. **Deploy:** `pnpm run deploy` oder `pnpm run preview`
3. **D1:** Keine Schema-Änderungen (außer ggf. bereits vorhandene `transport_id`-Spalte)

**Hinweis:** DO-Migration wird beim ersten Deploy ausgeführt.

---

## 7. Wichtig: env.d.ts und cloudflare-workers.d.ts

- **cloudflare-workers.d.ts** (Projektroot) enthält die Moduldeklaration für `cloudflare:workers`
- Nach `pnpm cf-typegen` (wrangler types) wird **env.d.ts** überschrieben – die cloudflare-workers.d.ts bleibt erhalten
- Falls TypeScript das Modul nicht findet: In PackingSyncDO.ts ist `/// <reference path="../../cloudflare-workers.d.ts" />` gesetzt

## 8. Offene Punkte (Optional)

- **Andere Module (Urlaube, Ausrüstung, etc.):** Offline-Cache und Sync-Queue sind vorbereitet (`offline-db.ts`, `offline-sync.ts`). Vollständige Nutzung erfordert Anpassungen in den jeweiligen Seiten.
- **Sync-Queue:** `processSyncQueue()` ist Stub; Offline-Mutationen müssen noch auf die passenden API-Endpunkte gemappt werden.
- **PWA:** Wenn gewünscht, kann die PWA in `next.config` wieder aktiviert werden für echten Offline-Start.

---

## 9. Lokale Tests

- **Next.js:** `pnpm dev` – WebSocket-Verbindung nur über Worker möglich
- **Worker:** `pnpm run preview` – Worker + DO werden lokal ausgeführt
- **WebSocket:** Mit zwei Tabs/Browsern dieselbe Packliste öffnen; Änderungen sollten synchron erscheinen
