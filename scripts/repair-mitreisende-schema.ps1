# Fehlende Spalten an mitreisende ergänzen (idempotent)
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

Write-Host "Reparatur mitreisende-Spalten ($label)..."

$columns = @{
    farbe = "./migrations/0005_mitreisende_farbe.sql"
    gruppe_id = "./migrations/0026_mitreisende_spalten.sql"
}

foreach ($col in $columns.Keys) {
    $exists = Get-D1Scalar "SELECT COUNT(*) AS c FROM pragma_table_info('mitreisende') WHERE name='$col';"
    if ($exists -eq 0) {
        Write-Host "Spalte '$col' fehlt - Migration ausfuehren..."
        Invoke-D1File $columns[$col]
    } else {
        Write-Host "Spalte '$col' vorhanden."
    }
}

$hasGruppeTable = Get-D1Scalar "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='mitreisenden_gruppe';"
if ($hasGruppeTable -eq 0) {
    Write-Host "Tabelle mitreisenden_gruppe fehlt - Migration 0026..."
    Invoke-D1File "./migrations/0026_mitreisenden_gruppen_rollen.sql"
} else {
    Write-Host "Tabelle mitreisenden_gruppe vorhanden."
}

Write-Host "Reparatur abgeschlossen."
