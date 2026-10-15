[CmdletBinding()]
param(
    [string]$ComposeFile = 'compose.yml',
    [string]$LocalOverride = 'compose.local.yml'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

# TEST STATIC-0: the official CRS image already loads setup.conf globally.
# Repeating modsecurity_rules_file in each location causes duplicate CRS rule IDs.
$defaultTemplate = Join-Path $projectRoot 'nginx\templates\conf.d\default.conf.template'
$duplicateLoaderLines = Select-String -Path $defaultTemplate -Pattern 'modsecurity_rules_file /etc/modsecurity.d/setup.conf;' -SimpleMatch
Assert-True ($duplicateLoaderLines.Count -eq 0) 'custom Nginx template does not duplicate the CRS setup rules file'

# PowerShell 5.1 can turn native stderr redirected with 2>&1 into a
# NativeCommandError under $ErrorActionPreference=Stop. Tests below
# intentionally provoke PostgreSQL errors, so wrap those native calls
# and capture both output and the real process exit code explicitly.
function Invoke-Native([scriptblock]$Block) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Block 2>&1 | Out-String
        [pscustomobject]@{ Exit = $LASTEXITCODE; Output = $out }
    } finally {
        $ErrorActionPreference = $old
    }
}

Write-Host "=== TechGear bootstrap smoke tests v2.3.0 ==="

# TEST 0: an .env that still contains obvious placeholders is not acceptable.
Assert-True (Test-Path .env) '.env exists for the running stack'
$envText = Get-Content .env -Raw
Assert-True ($envText -notmatch 'CHANGE_ME') '.env contains no CHANGE_ME placeholders'

# TEST 1: compose config must fail if .env and relevant process env vars are absent.
$backupEnv = $null
if (Test-Path .env) {
    $backupEnv = '.env.bootstrap-test-backup'
    if (Test-Path $backupEnv) { Remove-Item $backupEnv -Force }
    Move-Item .env $backupEnv
}
$envNames = @(
    'POSTGRES_BOOTSTRAP_PASSWORD','OWNER_DB_PASSWORD','APP_DB_PASSWORD',
    'POSTGRES_DB','POSTGRES_BOOTSTRAP_USER','OWNER_DB_USER','APP_DB_USER',
    'CLOUDFLARE_TUNNEL_TOKEN'
)
$oldEnv = @{}
foreach ($n in $envNames) {
    $oldEnv[$n] = [Environment]::GetEnvironmentVariable($n, 'Process')
    Remove-Item "Env:$n" -ErrorAction SilentlyContinue
}
try {
    $p = Start-Process docker -ArgumentList @('compose','-f',$ComposeFile,'-f',$LocalOverride,'config') -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\techgear-compose-out.txt" -RedirectStandardError "$env:TEMP\techgear-compose-err.txt"
    Assert-True ($p.ExitCode -ne 0) 'compose config fails without required .env secrets'
}
finally {
    foreach ($n in $envNames) {
        if ($null -eq $oldEnv[$n]) { Remove-Item "Env:$n" -ErrorAction SilentlyContinue }
        else { Set-Item "Env:$n" $oldEnv[$n] }
    }
    if ($backupEnv) { Move-Item $backupEnv .env }
}

# Remaining tests require the local stack to be running.
# TEST 1.5: verify Nginx is serving the real health endpoint.
$nginxId = & docker compose -f $ComposeFile -f $LocalOverride ps -q nginx 2>$null | Select-Object -First 1
Assert-True (-not [string]::IsNullOrWhiteSpace($nginxId)) 'Nginx container exists'

$nginxHealthCode = & curl.exe -sk -o NUL -w '%{http_code}' https://localhost:8443/healthz
Assert-True ($LASTEXITCODE -eq 0 -and $nginxHealthCode.Trim() -eq '200') 'Nginx /healthz returns HTTP 200'

$rootHeaders = & curl.exe -sS -D - -o NUL http://localhost:8080/ 2>&1 | Out-String
Assert-True ($LASTEXITCODE -eq 0) 'HTTP root is reachable through Nginx'
foreach ($h in @(
    'Strict-Transport-Security:',
    'X-Content-Type-Options:',
    'X-Frame-Options:',
    'Content-Security-Policy:',
    'Referrer-Policy:'
)) {
    Assert-True ($rootHeaders -match [regex]::Escape($h)) "HTTP 8080 returns $h"
}

# TEST 2: in non-tunnel local mode, a client-supplied CF-Connecting-IP must not rewrite $remote_addr.
$marker = 'smoke-realip-test'
& curl.exe -sS -o NUL -H 'CF-Connecting-IP: 1.2.3.4' "http://localhost:8080/?smoke=$marker" | Out-Null
$logResult = Invoke-Native { docker compose -f $ComposeFile -f $LocalOverride exec -T nginx sh -c "test -f /var/log/nginx/techgear-access.log && grep 'smoke=$marker' /var/log/nginx/techgear-access.log | tail -n 5" }
Assert-True ($logResult.Exit -eq 0) 'Nginx JSON access log file is readable'
$lines = $logResult.Output
Assert-True ($lines -match '"cf_connecting_ip":"1\.2\.3\.4"') 'fake CF-Connecting-IP header is visible in the test request log'
Assert-True ($lines -notmatch '"remote_addr":"1\.2\.3\.4"') 'untrusted CF-Connecting-IP does not rewrite remote_addr in local mode'

# TEST 3: ModSecurity SQLi payload -> 403 and audit log evidence.
$sqliStatus = & curl.exe -sS -o NUL -w '%{http_code}' "http://localhost:8080/?id=1%27%20OR%20%271%27%3D%271"
Assert-True ($sqliStatus -eq '403') 'SQL injection test returns HTTP 403'

# ModSecurity scanner User-Agent -> 403 and audit log evidence.
$scannerStatus = & curl.exe -sS -A 'sqlmap/1.8' -o NUL -w '%{http_code}' http://localhost:8080/
Assert-True ($scannerStatus -eq '403') 'sqlmap User-Agent returns HTTP 403 via ModSecurity'

$auditResult = Invoke-Native { docker compose -f $ComposeFile -f $LocalOverride exec -T nginx sh -c 'find /var/log/modsecurity/audit -type f -mmin -10 -exec cat {} \;' }
Assert-True ($auditResult.Exit -eq 0) 'ModSecurity audit directory is readable'
$audit = $auditResult.Output
Assert-True ($audit -match 'ruleId') 'ModSecurity JSON audit log contains ruleId information'
Assert-True ($audit -match 'TechGear scanner User-Agent blocked') 'scanner block message appears in JSON audit log'

# TEST 4: database least privilege.
# Avoid nested sh -c quoting because it breaks under Windows PowerShell 5.1.

$appIsSuperuserResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_app -d techgear_db -Atqc "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
}
Assert-True ($appIsSuperuserResult.Exit -eq 0) 'application role privilege query succeeds'
Assert-True ($appIsSuperuserResult.Output.Trim() -eq 'f') 'application role is not a PostgreSQL superuser'

$ownerIsSuperuserResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_owner -d techgear_db -Atqc "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
}
Assert-True ($ownerIsSuperuserResult.Exit -eq 0) 'owner privilege query succeeds'
Assert-True ($ownerIsSuperuserResult.Output.Trim() -eq 'f') 'owner/migration role is not a PostgreSQL superuser'

$createAsAppResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_app -d techgear_db -v ON_ERROR_STOP=1 -c "CREATE TABLE public.__techgear_app_must_not_create(id integer);"
}
Assert-True ($createAsAppResult.Exit -ne 0) 'application role cannot CREATE TABLE'
Assert-True ($createAsAppResult.Output -match 'permission denied for schema public') 'application CREATE TABLE failure is caused by schema permission denial'

# TEST 5: owner can create schema objects and app can perform only DML on them.
$cleanupBeforeOwnerCreate = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_owner -d techgear_db -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS public.__techgear_dml_smoke;"
}
Assert-True ($cleanupBeforeOwnerCreate.Exit -eq 0) 'owner can clean up any previous DML smoke-test object'

$createAsOwnerResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_owner -d techgear_db -v ON_ERROR_STOP=1 -c "CREATE TABLE public.__techgear_dml_smoke(id integer generated always as identity primary key, value text);"
}
Assert-True ($createAsOwnerResult.Exit -eq 0) 'owner role can create application schema objects'

$appDmlResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_app -d techgear_db -v ON_ERROR_STOP=1 -c "INSERT INTO public.__techgear_dml_smoke(value) VALUES ('smoke'); SELECT value FROM public.__techgear_dml_smoke;"
}
Assert-True ($appDmlResult.Exit -eq 0) 'application role can perform DML and use identity sequence privileges'
Assert-True ($appDmlResult.Output -match 'smoke') 'application DML test returned inserted row'

$dropAsOwnerResult = Invoke-Native {
    docker compose -f $ComposeFile -f $LocalOverride exec -T postgres psql -U techgear_owner -d techgear_db -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS public.__techgear_dml_smoke;"
}
Assert-True ($dropAsOwnerResult.Exit -eq 0) 'owner role can remove bootstrap test object'

# TEST 6: Nginx login rate limit must return HTTP 429 when the burst is exhausted.
# Run after all other tests because this intentionally consumes the strict login bucket.
$rateCodes = 1..12 | ForEach-Object {
    $code = & curl.exe -sS -o NUL -w '%{http_code}' -X POST http://localhost:8080/api/auth/login
    if ($LASTEXITCODE -ne 0) { throw "FAIL: curl exited with code $LASTEXITCODE during login rate-limit test" }
    $code.Trim()
}
Assert-True ($rateCodes -contains '429') 'login rate limit (1 req/s, burst 3) returns HTTP 429'

Write-Host '=== ALL BOOTSTRAP TESTS PASSED ===' -ForegroundColor Green

