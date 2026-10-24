# GitHub-Workflow: Project, Labels, Releases

Kurzüberblick für CampCheck (Hobby-Projekt, unregelmäßige Updates).

## Rollenverteilung

| Was | Wo pflegen |
|-----|------------|
| Typ (Fehler/Idee), Herkunft App | Labels `bug` / `enhancement` / `feedback` (App setzt die beim Melden) |
| Backlog vs. Roadmap, Arbeitsstand | **nur** GitHub Project-Status |
| Spiegel für die App-Roadmap | Labels `roadmap` + `status:*` – **automatisch** per Action (Zeitplan/manuell) |
| Neue Issues → Project | Action **Add Issues to Project** (jedes Issue bei opened/reopened) |

Project-Spalten: **Backlog → Todo → In Progress → In Test → Done**.

**Hinweis:** Die eingebaute Project-Automation „Auto-add“ ist optional. Zuverlässig ist die Repo-Action **Add Issues to Project**.

## Labels (Spiegel)

| Project-Status | Labels am Issue |
|----------------|-----------------|
| Backlog | keine `roadmap` / `status:*` |
| Todo | `roadmap` + `status:todo` |
| In Progress | `roadmap` + `status:in-progress` |
| In Test | `roadmap` + `status:in-test` |
| Done | Issue geschlossen; `roadmap` darf bleiben |

Alte Labels (`status:geplant`, `status:in-arbeit`, `status:erledigt`) nach dem Backfill löschen.

## Zwei Tokens – wofür und ob ein zweiter nötig ist

Es gibt **zwei getrennte Speicherorte**, auch wenn der PAT-Inhalt gleich sein könnte:

| Secret-Name | Wo liegt es? | Wofür |
|-------------|--------------|--------|
| `GITHUB_TOKEN` | Cloudflare (Worker), z. B. `wrangler secret` / `.dev.vars` | App erstellt/liest Feedback-Issues |
| `GH_PROJECT_TOKEN` | GitHub Repo → **Settings → Secrets and variables → Actions** | Sync-Workflow liest Project-Status und setzt Labels |

Dein bestehendes `GITHUB_TOKEN` (fine-grained, nur **Issues R/W**) reicht **nicht** für den Sync: der Workflow braucht zusätzlich **Projects** Read/Write und liegt in **GitHub Actions**, nicht in Cloudflare. Actions können dein Cloudflare-Secret nicht lesen.

### Warum du „Projects“ beim fine-grained Token nicht siehst

Fine-grained PATs können **user-eigene Projects** (URL etwa `github.com/users/PlhsBeatz/projects/…`) aktuell **nicht** anbinden. Die Permission „Projects“ erscheint dort nur zuverlässig bei **Organisations**-Projects – und selbst dann nicht unter Repository-Permissions wie Issues.

Für dein persönliches Board brauchst du deshalb einen **Personal access token (classic)** nur für den Sync. Das Cloudflare-`GITHUB_TOKEN` (fine-grained, Issues) bleibt unverändert für die App.

### Empfohlen: Classic-PAT nur für den Sync

1. Fine-grained-Dialog **abbrechen** (oder Token ohne Projects verwerfen).
2. GitHub → Profil → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
3. Note z. B. `campcheck-project-sync`, Expiration nach Geschmack (z. B. 90 Tage / 1 Jahr)
4. Scopes setzen:
   - **`repo`** – Issue-Labels am privaten Repo setzen
   - **`project`** – Project-Status lesen (Sync)
5. Token erzeugen, Wert einmal kopieren
6. Im **Repo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**  
   - Name genau: `GH_PROJECT_TOKEN`  
   - Wert: der Classic-Token  

**Wichtig:** In Actions gibt es schon einen eingebauten `github.token`. Deshalb heißt unser Secret bewusst `GH_PROJECT_TOKEN`, nicht `GITHUB_TOKEN`. Cloudflare-Secret nicht überschreiben.

### Danach noch (einmalig)

1. Repo → **Settings** → **Secrets and variables** → **Actions** → Tab **Variables** → **New repository variable**  
   - `PROJECT_NUMBER` = Zahl aus der Project-URL (`https://github.com/users/PlhsBeatz/projects/3` → `3`)
2. **Actions** → Workflow **Sync Project Status → Issue Labels** → **Run workflow** → Mode **backfill**
3. **Actions** → Workflow **Add Issues to Project** → **Run workflow** (einmaliger Backfill für alle offenen Issues)
4. Danach: jedes neue Issue wird bei Erstellung/Wiedereröffnung automatisch ins Project gelegt. Status→Label: manueller Sync-Backfill oder alle 6 Stunden.

**Warum Status→Label nicht sofort beim Ziehen?** GitHub Actions kennt kein Event `projects_v2_item`. **Issue→Project** dagegen schon (`issues` opened/reopened).

Skript lokal testen (optional):

```bash
set GH_PROJECT_TOKEN=…
set PROJECT_NUMBER=1
set MODE=backfill
node scripts/sync-project-status-labels.mjs
```

## Versionierung (SemVer ab 1.x)

- **Produktversion** in `package.json` und `src/lib/app-version.ts` (`APP_VERSION`) – gleich halten.
- **PATCH** = nur Fixes, **MINOR** = Features, **MAJOR** = großer Bruch.
- **Build-ID**: kurzer Git-SHA (`NEXT_PUBLIC_APP_BUILD_ID` beim Deploy) – jeder Build eindeutig, ohne SemVer zu ändern.
- Anzeige in der App: Einstellungen → **Infos zur App**.

### Was sind Tag und Release?

- **Tag** (`v1.0.0`): Namensschild auf **einem bestimmten Commit** („genau dieser Code-Stand“). Entsteht beim Anlegen des Releases mit.
- **Release**: die sichtbare Seite dazu (Titel + Notiz). Kein `git push`-Ersatz und kein Deploy – Deploy bleibt Push auf `main` / eure Action. Das Release **dokumentiert** nur den Stand.

Du brauchst dafür **keinen** Extra-Token und **keinen** Terminal-Befehl – nur die GitHub-Weboberfläche (nachdem `1.0.0` auf `main` ist und deployed wurde).

### Klickweg: erstes Release `v1.0.0`

1. Im Browser das Repo öffnen: `https://github.com/PlhsBeatz/camping-checkliste`
2. Rechts die Spalte **Releases** (oder Tab **Releases** unter Code) → **Create a new release** / **Draft a new release**
3. **Choose a tag**: `v1.0.0` eintippen → **Create new tag: v1.0.0 on publish**
4. **Target**: Branch **`main`** (der Commit, der gerade live ist)
5. **Release title**: z. B. `1.0.0`
6. **Describe this release** (Notiz), Beispiel:

   ```text
   Erste nummerierte Produktiv-Release.

   - Versionierung und App-Infos (Version, Roadmap)
   - Feedback getrennt unter Einstellungen
   - GitHub Project als Status-Quelle (Todo / In Progress / In Test / Done)
   ```

7. Optional: „Set as the latest release“ aktiv lassen
8. **Publish release**

Fertig. Unter Releases siehst du danach `v1.0.0`; der Tag erscheint auch unter dem Tab **Tags** / in der Commit-Historie als Markierung.

Spätere Releases genauso mit `v1.0.1`, `v1.1.0`, … – immer erst Version im Code anheben und deployen, dann Release mit passendem Tag.

## App-Seiten

| Nav | Route | Inhalt |
|-----|-------|--------|
| Infos zur App | `/einstellungen/infos` | Version, Roadmap |
| Feedback | `/einstellungen/feedback` | Melden, eigene Meldungen |

`/einstellungen/ueber` leitet auf Infos um.
