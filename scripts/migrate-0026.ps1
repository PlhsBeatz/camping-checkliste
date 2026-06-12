# Migration 0026 — idempotent (local oder --Remote)
param(
    [switch]$Remote
)

$ErrorActionPreference = "Stop"
$locFlag = if ($Remote) { "--remote" } else { "--local" }
$label = if ($Remote) { "remote" } else { "local" }

function Get-D1Scalar {
    param([string]$Sql)
    $raw = wrangler d1 execute camping-db $locFlag --command=$Sql --json 2>&1 | Out-String
    $json = $raw | ConvertFrom-Json
    $row = $json[0].results[0]
    if ($row.PSObject.Properties.Name -contains "c") { return [int]$row.c }
    foreach ($p in $row.PSObject.Properties) {
        if ($p.Name -ne "success") { return [int]$p.Value }
    }
    return 0
}

function Invoke-D1File {
    param([string]$Path)
    Write-Host "  -> $Path"
    wrangler d1 execute camping-db $locFlag --file=$Path
    if ($LASTEXITCODE -ne 0) { throw "Migration fehlgeschlagen: $Path" }
}

Write-Host "Migration 0026 ($label)..."

$hasGruppeId = Get-D1Scalar "SELECT COUNT(*) AS c FROM pragma_table_info('mitreisende') WHERE name='gruppe_id';"
if ($hasGruppeId -eq 0) {
    Write-Host "Schritt 1: Spalten an mitreisende..."
    Invoke-D1File "./migrations/0026_mitreisende_spalten.sql"
} else {
    Write-Host "Schritt 1: übersprungen (gruppe_id existiert bereits)."
}

Write-Host "Schritt 2: Gruppen + Daten..."
Invoke-D1File "./migrations/0026_mitreisenden_gruppen_rollen.sql"

$legacyUsers = Get-D1Scalar "SELECT COUNT(*) AS c FROM users WHERE role IN ('kind','gast');"
$legacyInvites = Get-D1Scalar "SELECT COUNT(*) AS c FROM einladungen WHERE role IN ('kind','gast');"
if ($legacyUsers -gt 0 -or $legacyInvites -gt 0) {
    Write-Host "Schritt 3: Nutzer- und Einladungsrollen..."
    Invoke-D1File "./migrations/0026_users_einladungen_rollen.sql"
} else {
    Write-Host "Schritt 3: übersprungen (keine Legacy-Rollen kind/gast)."
}

Write-Host "Migration 0026 abgeschlossen."
