[CmdletBinding()]
param(
    [string]$ComposeFile = 'compose.yml',
    [string]$LocalOverride = 'compose.local.yml',
    [string]$SeedFile = '/seed/001_seed.sql'
)

$ErrorActionPreference = 'Stop'

& docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql `
    -U techgear_owner `
    -d techgear_db `
    -v ON_ERROR_STOP=1 `
    -f $SeedFile

if ($LASTEXITCODE -ne 0) {
    throw "Database seed failed with exit code $LASTEXITCODE"
}

Write-Host 'Database seed completed.' -ForegroundColor Green
