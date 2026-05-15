# Camping Packliste App

Eine Web-App zum Planen und Abhaken von Camping-Packlisten: Ausrüstung, Urlaube, Mitreisende und Campingplätze an einem Ort — mit Offline-Nutzung als **Progressive Web App (PWA)** und Synchronisation, wenn wieder eine Verbindung besteht.

## Überblick

Die App richtet sich an alle, die vor der Fahrt nicht nur eine statische Liste brauchen, sondern **Mengen nach Reisedauer und Personen**, **mehrere Urlaube** und eine **gemeinsame Ausrüstungsdatenbank** nutzen möchten. Kern ist die interaktive **Packliste** pro Urlaub; ergänzend gibt es Auswertungen, Stammdaten und Hilfstools für unterwegs.

## Funktionen

### Packliste & Planung

- **Packliste** (`/`) — Gepackt-Markierung, Suche, Filter, Kategorien; Auswahl des aktuellen Urlaubs; Einzelpositionen und kontextabhängige Mengenlogik (z. B. Reisetage, Mitreisende).
- **Pack-Status** (`/pack-status`) — Überblick zum Fortschritt des Packens.
- **Urlaube** (`/urlaube`) — Reisen anlegen und verwalten; Verknüpfung mit Packliste und Mitreisenden.
- **Ausrüstung** (`/ausruestung`) — Inventar Ihrer Camping-Utensilien; Verknüpfung mit Tags und der Packliste.
- **Campingplätze** (`/campingplaetze`) — Stellplätze dokumentieren (u. a. mit Fotos und Standort); hilfreich für wiederkehrende Ziele oder Planung.

### Zusammenarbeit & Rechte

- **Mitreisende** (`/mitreisende`, in der Konfiguration) — Personen verwalten und mit Urlauben verknüpfen; **rollenbasierte Berechtigungen** (z. B. wer Stammdaten ändern darf).
- **Einladungen** — Gäste können über einen Link (`/einladung/[token]`) eingeladen werden.
- **Echtzeitnahe Synchronisation** der Packliste — mehrere Nutzer können parallel arbeiten; Konflikte werden serverseitig über einen Synchronisationspfad abgefedert.

### Tools

- **Sonnenausrichtung** (`/tools/sonnen-ausrichtung`) — Orientierung für Stellplatz/Aufstellung (Kompass/Himmelsrichtung, Sonnenstand).
- **Checklisten** (`/tools/checklisten`) — Zusätzliche, frei konfigurierbare Checklisten neben der Haupt-Packliste.

### Konfiguration (typisch Administrator)

Unter **Konfiguration** in der Seitenleiste (sichtbar je nach Rolle):

- **Kategorien** — Struktur der Packliste.
- **Tags & Labels** — Zuordnung von Ausrüstung zu Packregeln.
- **Mitreisende** — Stammdaten der Reisenden.
- **Transportmittel** — Fahrzeuge inkl. Gewichts-/Kapazitätslogik für die Packplanung.

### Nutzerkonto & Sicherheit

- **Mein Profil** (`/profil`) — z. B. Heimatort für Routenberechnungen.
- **Ersteinrichtung** (`/bootstrap`) — legt den ersten Administrator-Account an (nur wenn die Datenbank noch leer ist).
- Optional: **Passwort-Reset** und erzwungener Passwortwechsel nach Admin-Vorgabe.

### Offline & PWA

- **Installation** auf dem Homescreen (Standalone-Modus).
- **Offline-Banner** und lokaler Cache — Lesen und Einträge in eine Warteschlange; **Synchronisation** bei erneuter Verbindung.

## Technologie

| Bereich        | Technologie |
| -------------- | ----------- |
| Framework      | [Next.js](https://nextjs.org/) 15 (App Router), React 19 |
| UI             | Tailwind CSS, [Radix UI](https://www.radix-ui.com/), Lucide Icons |
| Deployment     | [OpenNext](https://opennext.js.org/) für [Cloudflare Workers](https://workers.cloudflare.com/) |
| Datenbank      | Cloudflare D1 (SQLite) |
| Offline        | [Dexie](https://dexie.org/) (IndexedDB), Service Worker über [Serwist](https://serwist.pages.dev/) |
| Realtime-Sync  | Cloudflare Durable Object (`PackingSyncDO`) |

## Voraussetzungen

- **Node.js** (empfohlen: aktuelle LTS-Version)
- **pnpm** (im Repo festgelegt, siehe `package.json` → `packageManager`)

## Lokale Entwicklung

```bash
pnpm install
pnpm dev
```

Anschließend die App unter [http://localhost:3000](http://localhost:3000) öffnen.

Weitere Scripts:

| Befehl            | Zweck                    |
| ----------------- | ------------------------ |
| `pnpm build`      | Production-Build (Next)  |
| `pnpm start`      | Production-Server lokal  |
| `pnpm lint`       | ESLint                   |
| `pnpm build:worker` | OpenNext-Build für CF  |
| `pnpm preview`    | Vorschau mit Worker-Build |

## Umgebungsvariablen

Vorlage: [`.env.example`](.env.example).

- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** — für Karten und clientseitige Google-Maps-Nutzung (lokal in `.env.local` für `pnpm dev`).
- **`GOOGLE_MAPS_API_KEY`** — serverseitig u. a. für **Routen-/Distanzberechnung** zur Campingplatz-Planung (Distance Matrix), falls konfiguriert.

Ohne Schlüssel können einige Kartenerlebnisse oder präzise Routen geschwächt sein; die App fällt wo möglich auf Schätzungen (z. B. Luftlinie) zurück.

## Ersteinrichtung

1. Datenbank/API gemäß Cloudflare-Setup initialisieren (siehe bestehende Deploy-/Wrangler-Konfiguration im Projekt).
2. Im Browser **`/bootstrap`** aufrufen und den **ersten Administrator** anlegen.
3. Danach normale Anmeldung; weitere Nutzer über Einladung oder Admin-Flow.

## Deployment

Für Cloudflare steht u. a. **`pnpm deploy`** bereit (Build + Upload — Details hängen von Ihrer Wrangler-/Account-Konfiguration ab). Vor dem ersten Deploy D1-Migrationen und Secrets (`GOOGLE_MAPS_API_KEY` etc.) in der Cloudflare-Umgebung setzen.

---

Dieses Repository ist als **`private`** gekennzeichnet; Lizenz und Weitergabe richten sich nach Ihren eigenen Vorgaben.
