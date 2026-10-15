[CmdletBinding()]
param([string]$EnvFile = '.env')

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $EnvFile)) { throw "$EnvFile does not exist" }

$raw = Get-Content $EnvFile -Raw
$current = [regex]::Match($raw, '(?m)^AES_KEY=(.*)$')
$value = if ($current.Success) { $current.Groups[1].Value.Trim() } else { '' }

if ($value -and ([Convert]::FromBase64String($value)).Length -eq 32) {
    Write-Host 'AES_KEY is already configured.' -ForegroundColor Green
    exit 0
}

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $key = [Convert]::ToBase64String($bytes)
} finally {
    $rng.Dispose()
}

if ($current.Success) {
    $raw = [regex]::Replace($raw, '(?m)^AES_KEY=.*$', "AES_KEY=$key")
} else {
    $raw = $raw.TrimEnd() + "`r`nAES_KEY=$key`r`n"
}
Set-Content $EnvFile $raw -NoNewline
Write-Host 'Generated a fresh AES-256-GCM key in .env.' -ForegroundColor Green
