# Cloudflare Pages Deployment Guide - Camping Packliste App

## Übersicht

Diese Anleitung beschreibt die Einrichtung und das Deployment der Camping-Packlisten-App auf Cloudflare Pages mit D1-Datenbankintegration.

## Voraussetzungen

- Cloudflare-Konto (kostenlos)
- GitHub-Repository mit dem Projekt-Code
- Node.js 18+ (lokal für Tests)
- pnpm oder npm

## Schritt 1: Cloudflare D1-Datenbank erstellen

### Option A: Via Cloudflare Dashboard

1. Gehen Sie zu [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigieren Sie zu **Workers & Pages** → **D1**
3. Klicken Sie auf **Create Database**
4. Geben Sie den Namen `camping-db` ein
5. Notieren Sie sich die **Database ID**

### Option B: Via CLI

```bash
npx wrangler d1 create camping-db
```

Die CLI gibt Ihnen die `database_id` zurück.

## Schritt 2: Datenbank-Schema initialisieren

Führen Sie das SQL-Schema aus:

```bash
npx wrangler d1 execute camping-db --remote --file=./migrations/0001_initial.sql
```

Oder manuell im Cloudflare Dashboard unter **D1 → camping-db → Console**:

```sql
CREATE TABLE IF NOT EXISTS vacations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  travelers TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packing_items (
  id TEXT PRIMARY KEY,
  vacationId TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  isPacked INTEGER DEFAULT 0,
  category TEXT NOT NULL,
  mainCategory TEXT NOT NULL,
  details TEXT,
  weight REAL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vacationId) REFERENCES vacations(id)
);

CREATE TABLE IF NOT EXISTS equipment_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  mainCategory TEXT NOT NULL,
  weight REAL NOT NULL,
  defaultQuantity INTEGER DEFAULT 1,
  status TEXT,
  details TEXT,
  links TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_packing_vacation ON packing_items(vacationId);
CREATE INDEX idx_equipment_category ON equipment_items(mainCategory);
```

## Schritt 3: wrangler.toml aktualisieren

Stellen Sie sicher, dass Ihre `wrangler.toml` korrekt konfiguriert ist:

```toml
name = "camping-checkliste"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".next/static"

[[d1_databases]]
binding = "DB"
database_name = "camping-db"
database_id = "IHRE-DATABASE-ID-HIER"
preview_id = "IHRE-DATABASE-ID-HIER"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }
```

**Wichtig:** Ersetzen Sie `IHRE-DATABASE-ID-HIER` mit der ID aus Schritt 1.

## Schritt 4: GitHub-Repository verbinden

1. Pushen Sie den Code zu GitHub:
```bash
git add .
git commit -m "Add Cloudflare D1 integration"
git push origin main
```

2. Gehen Sie zu [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Navigieren Sie zu **Workers & Pages** → **Pages**
4. Klicken Sie auf **Create application** → **Connect to Git**
5. Wählen Sie Ihr GitHub-Repository
6. Konfigurieren Sie die Build-Einstellungen:
   - **Framework preset:** Next.js
   - **Build command:** `pnpm install && pnpm build`
   - **Build output directory:** `.next/static`
   - **Root directory:** `/` (oder leer lassen)

7. Unter **Environment variables** (optional):
   - Fügen Sie `ENVIRONMENT=production` hinzu

8. Klicken Sie auf **Save and Deploy**

## Schritt 5: D1-Datenbank in Cloudflare Pages binden

Nach dem ersten Deployment:

1. Gehen Sie zu Ihrer Pages-Anwendung im Dashboard
2. Klicken Sie auf **Settings** → **Functions**
3. Unter **D1 Database Bindings** klicken Sie auf **Add binding**
4. Konfigurieren Sie:
   - **Variable name:** `DB`
   - **Database:** `camping-db`
5. Klicken Sie auf **Save**

## Schritt 6: Lokales Testen

Zum lokalen Testen mit D1:

```bash
# Abhängigkeiten installieren
pnpm install

# Entwicklungsserver starten
pnpm dev

# In einem anderen Terminal: D1 mit Wrangler starten
npx wrangler pages dev .next/static --d1 DB
```

Die App sollte unter `http://localhost:8788` verfügbar sein.

## Troubleshooting

### Problem: "Database not configured"

**Lösung:** Stellen Sie sicher, dass:
- Die D1-Datenbank in Cloudflare Pages gebunden ist
- Die `database_id` in `wrangler.toml` korrekt ist
- Die Environment-Variable `DB` in den Pages-Einstellungen konfiguriert ist

### Problem: "Build fehlgeschlagen"

**Lösung:**
- Überprüfen Sie die Build-Logs im Cloudflare Dashboard
- Stellen Sie sicher, dass `pnpm install` erfolgreich ist
- Prüfen Sie, ob alle Abhängigkeiten in `package.json` vorhanden sind

### Problem: API-Routen antworten nicht

**Lösung:**
- Überprüfen Sie die Browser-Konsole auf Fehler
- Prüfen Sie die Cloudflare Pages-Logs
- Stellen Sie sicher, dass die API-Routen unter `/src/app/api/` vorhanden sind

### Problem: Datenbank ist leer

**Lösung:**
- Führen Sie das Schema-Initialisierungs-SQL aus
- Überprüfen Sie, dass die Tabellen erstellt wurden:
  ```sql
  SELECT name FROM sqlite_master WHERE type='table';
  ```

## API-Endpoints

Die App stellt folgende Endpoints zur Verfügung:

### Vacations (Urlaubsreisen)
- `GET /api/vacations` - Alle Reisen abrufen
- `POST /api/vacations` - Neue Reise erstellen

### Packing Items (Packartikel)
- `GET /api/packing-items?vacationId=<id>` - Artikel für Reise abrufen
- `POST /api/packing-items` - Neuen Artikel erstellen
- `PUT /api/packing-items` - Artikel aktualisieren
- `DELETE /api/packing-items?id=<id>` - Artikel löschen

### Equipment (Ausrüstung)
- `GET /api/equipment` - Alle Ausrüstungsgegenstände abrufen
- `POST /api/equipment` - Neuen Gegenstand erstellen

### Initialization
- `POST /api/init` - Datenbank initialisieren

## Sicherheit

### Best Practices

1. **Authentifizierung:** Für eine Produktions-App sollten Sie Authentifizierung hinzufügen:
   - Cloudflare Access
   - Auth0
   - Supabase Auth

2. **Row Level Security (RLS):** Implementieren Sie RLS in D1, um Benutzer auf ihre eigenen Daten zu beschränken

3. **Rate Limiting:** Nutzen Sie Cloudflare's Rate Limiting für die API-Routen

4. **CORS:** Konfigurieren Sie CORS-Header für API-Anfragen

## Performance-Optimierungen

1. **Caching:** Nutzen Sie Cloudflare's Cache-API für häufig abgerufene Daten
2. **Kompression:** Gzip-Kompression ist standardmäßig aktiviert
3. **CDN:** Alle statischen Assets werden über Cloudflare's CDN verteilt

## Weitere Ressourcen

- [Cloudflare Pages Dokumentation](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 Dokumentation](https://developers.cloudflare.com/d1/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Wrangler CLI Dokumentation](https://developers.cloudflare.com/workers/wrangler/)

## Support

Für Fragen oder Probleme:
1. Überprüfen Sie die Cloudflare-Logs
2. Konsultieren Sie die offizielle Dokumentation
3. Erstellen Sie ein Issue im GitHub-Repository
