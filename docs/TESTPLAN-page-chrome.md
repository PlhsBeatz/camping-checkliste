# Testplan: Page-Chrome Phase 0–1

Ziel: Prüfen, dass `PageShell` / `PageHeader` auf den Pilot-Seiten korrekt greifen und Settings sowie nicht umgestellte Seiten unverändert bleiben.

## Vorbereitung

- Dev-Server lokal, eingeloggt (idealerweise mit Config-Rechten für Rastplätze-FAB)
- Einmal Desktop (≥ 1024px) und einmal Mobile / DevTools-Device testen

---

## 1. Pilot: Rastplätze (`/rastplaetze`)

| # | Schritt | Erwartung |
|---|---------|-----------|
| 1.1 | Seite öffnen | Sticky-Header „Rastplätze“, Menü-Button nur mobil sichtbar |
| 1.2 | Desktop: Hauptnav links | Sidebar sichtbar, Content mit `ml` Offset, kein doppelter Scrollbar bei kurzem Inhalt |
| 1.3 | Mobil: Hamburger | Sidebar öffnet/schließt; Body scrollt nicht unter dem Overlay |
| 1.4 | ⋮-Menü → GPX | Export startet (wie bisher) |
| 1.5 | Als Admin: FAB + | Dialog zum Anlegen; Karte/Tabelle laden |
| 1.6 | Header sticky | Beim Scrollen bleibt Header oben, Schatten sichtbar |

## 2. Pilot: Vorschläge (`/tools/vorschlaege`)

| # | Schritt | Erwartung |
|---|---------|-----------|
| 2.1 | Seite öffnen | Titel „Vorschläge“ + Untertitel; Sticky `z-20` |
| 2.2 | Leerer Zustand | `BrandEmptyState` „Alles im Lot“ |
| 2.3 | Mit Einträgen | Karten-Grid; Aktionen Accept/Dismiss/Snooze wie bisher |
| 2.4 | Mobil: Menü | Nav öffnet; Overlay-Scroll-Lock |

## 3. Pilot: Optimierungen (`/tools/optimierungen`)

| # | Schritt | Erwartung |
|---|---------|-----------|
| 3.1 | Mit Leserecht | Titel + Untertitel; Tool-Inhalt darunter |
| 3.2 | Header-Aktionen | Buttons/Portal rechts im Header (wie bisher über `headerTrailingRef`) |
| 3.3 | Ohne Leserecht | Redirect nach `/` |
| 3.4 | Mobil: Menü | wie bei anderen Piloten |

## 4. Regression: Einstellungen

| # | Schritt | Erwartung |
|---|---------|-----------|
| 4.1 | Desktop `/einstellungen` | Redirect nach Darstellung |
| 4.2 | Mobil `/einstellungen` | Gruppierte Nav, kein Intro-Text |
| 4.2b | Stammdaten z. B. `/einstellungen/kategorien` | Subnav aktiv; Alt `/kategorien` redirectet |
| 4.3 | Unterseite z. B. Standort | Settings-Subnav Desktop; Picker + Zurück mobil |
| 4.4 | Hauptnav → Einstellungen | Eintrag sichtbar (auch echtes Smartphone) |

## 5. Regression: Nicht umgestellte Seiten (Stichprobe)

Kurz öffnen und Layout/Nav prüfen (weiterhin altes Chrome, aber funktional):

- `/` (Heute)
- `/urlaube`
- `/campingplaetze`
- `/packliste`
- `/ausruestung`
- `/tools/wartung`

Erwartung: kein Layout-Bruch, Sidebar und Inhalte wie zuvor.

## 6. Technische Checks

| # | Check | Erwartung |
|---|--------|-----------|
| 6.1 | Import `AppShell` | Datei entfernt; keine Referenzen im Code |
| 6.2 | Console | Keine Fehler „usePageShell must be used within PageShell“ |
| 6.3 | `PageHeader` außerhalb Shell | absichtlich nicht – nur in `PageShell`-Kindern |

---

## Abnahmekriterien Phase 1

- [ ] Drei Pilot-Seiten nutzen ausschließlich `PageShell` + `PageHeader` (kein lokales Sidebar-/Scroll-Lock-Duplikat)
- [ ] Sticky-Header der Piloten mit `z-20`
- [ ] Mobile Nav + Einstellungen-Button ok
- [ ] Settings-Flow unverändert
- [ ] Keine neuen Runtime-Fehler auf den getesteten Routen

---

## Phase 2 – weitere Seiten

### Listen / Hub

| Route | Prüfen |
|-------|--------|
| `/` Heute | Header, bg-scroll-pattern, Attention-Karten, Push-Banner |
| `/urlaube` | Header-Aktionen (Ansicht/Import), Liste, FAB |
| `/campingplaetze` | Liste, FAB, Edit-Modal |
| `/pack-status` | Header, Status-Inhalt, Pull-to-Refresh falls vorhanden |

### Tools

| Route | Prüfen |
|-------|--------|
| `/tools/wartung` | Header, Dashboard, FAB/Dialoge |
| `/tools/verbrauch` | Header, Verbrauch-UI |
| `/tools/sonnen-ausrichtung` | Header, Karte/Kompass |
| `/tools/checklisten` | Sticky Header + Fortschrittsbalken; Trailing-Actions |

### Details (BackLink auch mobil)

| Route | Prüfen |
|-------|--------|
| `/urlaube/[id]` | „Zur Liste“ sichtbar auf Mobile und Desktop |
| `/campingplaetze/[id]` | BackLink; mobil Vollhöhe (`h-dvh`) wie zuvor |
| `/tools/optimierungen/[id]` | BackLink zur Optimierungen-Liste |

### Settings

- `/einstellungen/*` – weiter `ConfigPageLayout`

### Abnahmekriterien Phase 2

- [ ] Alle Phase-2-Routen: Menu mobil öffnet Sidebar; Desktop-Sidebar sichtbar
- [ ] Kein doppelter Body-Scroll-Lock-Bug; kein Dauer-Scrollbar bei kurzem Inhalt
- [ ] Detail-Back auf Smartphone sichtbar und navigiert korrekt
- [ ] Checklisten-Progress bleibt unter dem Titel kleben
- [ ] Packliste/Ausrüstung/Settings unverändert nutzbar

---

## Phase 3 – ListTile / BrandFab / BrandSpinner / CardTitle

| # | Prüfen | Erwartung |
|---|--------|-----------|
| 3.1 | Campingplätze / Rastplätze / Urlaube-Liste | Kacheln optisch wie zuvor (`ListTile`) |
| 3.2 | Wartung-Dashboard, Vorlagen, Checklisten-/Optimierungen-Listen | Zeilen unverändert nutzbar |
| 3.3 | FAB auf Listen/Tools/Packliste/Ausrüstung | Klick öffnet Dialog/Aktion; Position unten rechts |
| 3.4 | FabMenuM3 (Kategorien/Tags/…) | Speed-Dial öffnet; Primary-Grün |
| 3.5 | Ladezustand Campingplätze/Rastplätze/Wartung/Verbrauch/Ausrüstung | Brand-Spinner + Label |
| 3.6 | Einstellungen Cards (Darstellung, Konto, Feedback, …) | Titel ~`text-lg`, nicht riesig (`text-2xl`) |

### Abnahmekriterien Phase 3

- [ ] Keine regressiven Layout-Brüche an Entity-Listen
- [ ] Alle Single-FABs reagieren; Packliste-FAB mit Sidebar-Offset ok
- [ ] Spinner ohne Hardcoded-RGB, lesbares Label
- [ ] Settings-Kartentitel angemessen groß

---

## Mobile Geister-Scroll (Fix nach Phase 3)

Ursache: `min-h-screen` (100vh) > sichtbarer Viewport im Browser mit URL-Leiste. Shells nutzen jetzt `min-h-dvh`.

| # | Prüfen | Erwartung |
|---|--------|-----------|
| M.1 | Kurze Seite im Mobile-Browser (nicht PWA), z. B. Einstellungen/Darstellung oder leere Vorschläge | Kein bzw. kein spürbares Vertikal-Scrollen ohne Inhalt |
| M.2 | Lange Seite (Urlaub-Detail) | Normales Scrollen weiter möglich |
| M.3 | Optional: als PWA installiert | Gleich oder besser (oft kein URL-Bar-Offset) |

---

## Phase 4 – Packliste / Ausrüstung / RGB-Tokens

| # | Prüfen | Erwartung |
|---|--------|-----------|
| 4.1 | `/ausruestung` | Header, Tabellen-Scroll intern, FAB, Menü mobil |
| 4.2 | `/packliste` ohne Urlaub | Shell ok, kein Bruch |
| 4.3 | `/packliste` mit Urlaub | Flex-Header, Progress/Tabs, Packprofil-Sidebar Desktop, FAB mit Offset |
| 4.4 | Packliste mobil: Packprofil öffnen | Body-Scroll gesperrt; Hauptnav separat über Hamburger |
| 4.5 | Stichprobe Brand-Farben (Checkboxen, Active, FABs) | Grün über Tokens, optisch wie zuvor |

### Abnahmekriterien Phase 4

- [ ] Ausrüstung: Sticky-Header + Tabellen-Scroll wie zuvor
- [ ] Packliste: Dual-Layout und Packen unverändert nutzbar
- [ ] Keine sichtbaren Farb-Regressionen an Primary-Buttons/FABs
- [ ] Settings unverändert
