[CmdletBinding()]
param(
    [string]$ComposeFile = 'compose.yml',
    [string]$LocalOverride = 'compose.local.yml',
    [string[]]$Migrations = @(
        '/migrations/001_initial_schema.sql',
        '/migrations/002_authentication.sql',
        '/migrations/003_checkout_security.sql'
    )
)

$ErrorActionPreference = 'Stop'

foreach ($migration in $Migrations) {
    & docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql `
        -U techgear_owner `
        -d techgear_db `
        -v ON_ERROR_STOP=1 `
        -f $migration

    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed for $migration with exit code $LASTEXITCODE"
    }

    Write-Host "Applied migration: $migration" -ForegroundColor Green
}

Write-Host 'Database migrations completed.' -ForegroundColor Green
