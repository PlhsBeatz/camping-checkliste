# Design-Standards

Lebendes Dokument für UI-Muster der Camping-Checkliste. **Source of Truth für Look & Feel** sind Tokens in `src/app/globals.css` und Shared Components unter `src/components/`. Cursor-Rules (`.cursor/rules/ui-design.mdc`) verweisen hierher und bleiben kurz.

Bei neuen Screens: bestehende Shells und Komponenten spiegeln, keine Parallel-Layouts erfinden.

---

## Komponenten-Katalog

| Komponente | Pfad | Wann nutzen |
|------------|------|-------------|
| **PageShell** | [`page-shell.tsx`](../src/components/page-shell.tsx) | Neue/überarbeitete App-Seiten mit Hauptnav (Listen, Tools, Hub) |
| **PageHeader** | [`page-header.tsx`](../src/components/page-header.tsx) | Sticky-Titelzeile innerhalb von `PageShell` (Menu, h1, Actions) |
| **BackLink** | [`back-link.tsx`](../src/components/back-link.tsx) | Zurück auf Detail-/Unterseiten (`labeled` oder `icon`) |
| **ConfigPageLayout** | [`config-page-layout.tsx`](../src/components/config-page-layout.tsx) | Einstellungen & Stammdaten (Auth, Subnav, Mobile-Picker) |
| **ConfigSubnav** / **GroupedNavList** | [`config-subnav.tsx`](../src/components/config-subnav.tsx), [`grouped-nav-list.tsx`](../src/components/grouped-nav-list.tsx) | Settings-Navigation |
| **NavigationSidebar** | [`navigation-sidebar.tsx`](../src/components/navigation-sidebar.tsx) | App-Hauptmenü (nur über Shells, nicht manuell duplizieren) |
| **BrandEmptyState** | [`brand-empty-state.tsx`](../src/components/brand-empty-state.tsx) | Seiten-Leerzustand mit Illustration |
| **ResponsiveModal** | [`ui/responsive-modal.tsx`](../src/components/ui/responsive-modal.tsx) | Formular-Dialoge (Desktop Dialog / Mobile Drawer) |
| **ListTile** | [`list-tile.tsx`](../src/components/list-tile.tsx) | Entity-Zeilen (`rounded-xl border-subtle …`) |
| **BrandFab** | [`brand-fab.tsx`](../src/components/brand-fab.tsx) | Einzelner Floating Action Button |
| **FabMenuM3** | [`fab-menu-m3.tsx`](../src/components/fab-menu-m3.tsx) | Speed-Dial / Multi-Action-FAB |
| **BrandSpinner** | [`brand-spinner.tsx`](../src/components/brand-spinner.tsx) | Full-page / Block-Ladeindikator |
| **CardTitle** | [`ui/card.tsx`](../src/components/ui/card.tsx) | Default `text-lg` (nicht mehr `text-2xl`) |

**Umgestellt auf PageShell/PageHeader:** Heute, Urlaube (+ Detail), Campingplätze (+ Detail), Rastplätze, Pack-Status, Packliste (`bare` + Flex-Header), Ausrüstung (`h-dvh` + Tabellen-Scroll), Tools (Wartung, Verbrauch, Sonnen-Ausrichtung, Checklisten, Vorschläge, Optimierungen + Detail).

**Weiterhin eigene Shell:** Settings über `ConfigPageLayout` (nicht `PageShell`).

---

## Markenfarben / Tokens

Definiert in `src/app/globals.css` (`:root` / `.dark`):

| Token / Klasse | Verwendung |
|----------------|------------|
| `--brand-green` / `.bg-brand` | Primärflächen, Active-Nav |
| `.nav-item-active` | Aktiver Nav-Eintrag (Brand-Fill + weiße Schrift) |
| `.bg-brand-muted` | Dezente Brand-Hintergründe (Icon-Tiles) |
| `.text-brand-heading` | Seiten- und Kartentitel |
| `.border-subtle` | Ruhige Listen-/Kartenränder (Light/Dark) |
| `--brand-orange` | Akzente / besondere Highlights |
| shadcn `primary`, `muted`, `card`, … | Buttons, Formulare (`bg-primary` ≈ Brand-Grün) |

**Nicht:** rohes `rgb(45,79,30)` in neuem Code – `.bg-brand` / `bg-primary` nutzen.  
**Palette:** App-Grün / Orange / Beige ist kanonisch.

---

## Page-Chrome

### App-Seiten (Listen, Tools, Hub)

```tsx
<PageShell containerClassName="space-y-6">
  <PageHeader title="…" subtitle="…" actions={…} />
  {/* Inhalt */}
</PageShell>
```

Soll-Klassen (in `PageHeader` gekapselt):

- Sticky: `sticky top-0 z-20 bg-card shadow` + etablierte Negativ-Margins
- h1: `text-lg sm:text-xl font-bold tracking-tight text-brand-heading truncate`
- Menu-Button: `outline` / `icon`, nur `< lg`

`PageShell` übernimmt Sidebar, `lg:ml-[280px]`, Body-Scroll-Lock, Mindesthöhe `min-h-dvh` (nicht `min-h-screen` – vermeidet Geister-Scroll im Mobile-Browser bei wenig Content). Kein manuelles Kopieren dieses Skeletts.

### Detail-Seiten

Gleicher `PageShell` + `PageHeader`. Zurück über `BackLink` (`visible="always"` neu; Legacy `mdUp` nur bei Migration). Hover: `hover:bg-muted`.

### Einstellungen / Stammdaten

Immer [`ConfigPageLayout`](../src/components/config-page-layout.tsx) – **nicht** `PageShell`:

- Desktop: `/einstellungen` → `SETTINGS_DEFAULT_HREF` (Darstellung); Subnav in `SETTINGS_NAV_COLUMN_CLASS`
- Mobile Hub: gruppierte Nav; Unterseiten: Picker + Drawer + Zurück

---

## Ausnahmen (bewusst)

| Bereich | Warum abweichend |
|---------|------------------|
| **Packliste** | `PageShell bare` + `PageHeader sticky={false}`; Dual-Sidebar Packprofil; `h-dvh`-Scroll |
| **Ausrüstung** | `PageShell` mit `h-dvh` + internem Tabellen-Scroll |
| **Login / Bootstrap / Einladung / Passwort-vergessen / ~offline / Gmail-Suche** | Kein App-Menü, zentrierte Minimal-Layouts |
| **Packlisten-Items** | Komplexe States – nicht 1:1 `ListTile` |
| **Canvas/SVG/Icons** | Literale Brand-Farbe wo Tailwind-Klassen nicht greifen (Maps, Charts, `apple-icon`) |

---

## Navigation

| Ebene | Komponente | Hinweis |
|-------|------------|---------|
| App-Hauptnav | `NavigationSidebar` | Active: `.nav-item-active` |
| Einstellungen-Daten | `settings-navigation.ts` | inkl. `SETTINGS_DEFAULT_HREF` |
| Einstellungen-UI | `ConfigSubnav` → `GroupedNavList` | überall dasselbe Muster |
| Mobile Bereichswechsel | `ConfigMobileSectionPicker` | Drawer mit `GroupedNavList` |

### Grouped Nav

[`GroupedNavList`](../src/components/grouped-nav-list.tsx): Karte pro Gruppe, interne Trenner, Chevron, Active dezent. Breite: `SETTINGS_NAV_COLUMN_CLASS`.

---

## Listen & Karten

| Muster | Wann | Optik |
|--------|------|--------|
| **GroupedNavList** | Settings-Nav | Kartengruppen, interne Trenner |
| **ListTile** | Entity-Zeilen | `rounded-xl border border-subtle shadow-sm px-4 py-3` |
| **Card** | Formular-/Feature-Blöcke | `CardTitle` Default `text-lg`; bei Bedarf `text-base` überschreiben |

---

## Do / Don’t

**Do**

- Neue App-Listen/Tools: `PageShell` + `PageHeader`
- Neue Einstellungen: `ConfigPageLayout` + `SETTINGS_NAV_GROUPS`
- Brand-Utilities / `border-subtle` / `bg-primary`

**Don’t**

- Outer-Flex + Sidebar + Sticky-Header manuell kopieren
- `AppShell` wiederbeleben (entfernt)
- Neues `rgb(45,79,30)` oder abweichende Sticky-`z-*` ohne Grund

---

## Offene Vereinheitlichungen

### Erledigt (Phase 0–4)

- Komponenten-Katalog und Ausnahmen dokumentiert
- `PageShell` / `PageHeader` / `BackLink` eingeführt und breit adoptiert (inkl. Packliste/Ausrüstung)
- Detail-Zurück: `BackLink` mit `visible="always"`
- `AppShell` entfernt
- `ListTile`, `BrandFab`, `BrandSpinner` eingeführt und adoptiert
- `FabMenuM3` auf `bg-primary`
- `CardTitle`-Default → `text-lg`
- Tailwind-Klassen `rgb(45,79,30)` → Tokens (`bg-primary` / `text-brand-heading` / …); Rest: Icons, Canvas/SVG, Charts

### Offen (optional)

1. `ConfigPageLayout` intern auf `PageShell` stützen
2. Stammdaten-URLs unter `/einstellungen/…`
3. Verbleibende Literal-Farben in Maps/Charts/Progress-JS vereinheitlichen (nur wo sinnvoll)

Neue Einträge hier ergänzen; Erledigtes nach oben verschieben.
