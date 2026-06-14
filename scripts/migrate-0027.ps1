# Migration 0027: Pauschal-Gruppen-Zuordnung
# Idempotent ausfuehren (Spalten/Tabellen nur anlegen wenn fehlend).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$migration = Join-Path $root "migrations\0027_pauschal_gruppen.sql"

if (-not (Test-Path $migration)) {
    Write-Error "Migration nicht gefunden: $migration"
}

Write-Host "Fuehre Migration 0027 aus..."
npx wrangler d1 execute camping-db --local --file=$migration
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Migration 0027 abgeschlossen."
