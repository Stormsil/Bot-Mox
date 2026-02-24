Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[stack-one-up] $Message"
}

function Assert-LastExitCode([string]$StepName) {
  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed with exit code $LASTEXITCODE"
  }
}

function Is-Truthy([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }
  return $Value.Trim().ToLowerInvariant() -match '^(1|true|yes|on)$'
}

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Write-SmokeAuditStatus(
  [string]$RepoRoot,
  [string]$AuditName,
  [string]$Status,
  [string]$Details = ''
) {
  try {
    $auditsDir = Join-Path $RepoRoot 'docs/audits'
    New-Item -ItemType Directory -Path $auditsDir -Force | Out-Null
    $timestamp = [DateTime]::UtcNow.ToString('o')
    $safeDetails = ([string]$Details).Replace("`r", ' ').Replace("`n", ' ').Trim()
    $content = @(
      "timestamp=$timestamp"
      "audit_name=$AuditName"
      "status=$Status"
      "details=$safeDetails"
    )
    $latestPath = Join-Path $auditsDir "$AuditName-latest.txt"
    $tsPath = Join-Path $auditsDir ("{0}-{1}.txt" -f $AuditName, ([DateTime]::UtcNow.ToString('yyyy-MM-dd_HH-mm-ss')))
    Set-Content -Path $latestPath -Value $content -Encoding UTF8
    Set-Content -Path $tsPath -Value $content -Encoding UTF8
  } catch {
    Write-Step "Warning: failed to write smoke audit '$AuditName': $($_.Exception.Message)"
  }
}

function Get-EnvFilePath([string]$RepoRoot) {
  $envFile = Join-Path $RepoRoot 'deploy/compose.prod-sim.env'
  $examplePath = Join-Path $RepoRoot 'deploy/compose.prod-sim.env.example'

  if (!(Test-Path $envFile)) {
    Write-Step "Local env file is missing. Creating deploy/compose.prod-sim.env from example."
    Copy-Item -Path $examplePath -Destination $envFile
  }

  return $envFile
}

function Import-EnvFile([string]$EnvFilePath) {
  Get-Content -Path $EnvFilePath | ForEach-Object {
    $line = [string]$_
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.TrimStart().StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }

    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($name.Length -eq 0) { return }
    $existing = [string]([Environment]::GetEnvironmentVariable($name, 'Process'))
    if ([string]::IsNullOrWhiteSpace($existing)) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Wait-HttpReady([string]$Url, [int]$TimeoutSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }
  }
  throw "Timed out waiting for $Url"
}

function Wait-AdminUiReady([int]$TimeoutSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost' -TimeoutSec 5 -Headers @{ Host = 'admin.localhost' }
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }
  }
  throw "Timed out waiting for admin UI via Host header (http://localhost, Host=admin.localhost)"
}

function Run-AuthAccessSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_AUTH_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Auth smoke is disabled (set BOTMOX_RUN_AUTH_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'auth-access-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  $billingMode = [string]([Environment]::GetEnvironmentVariable('BILLING_MODE', 'Process'))
  if ([string]::IsNullOrWhiteSpace($billingMode)) {
    $billingMode = 'stub'
  }
  $adminOriginAllowed = [string]([Environment]::GetEnvironmentVariable('BOTMOX_ADMIN_ORIGIN_SMOKE_ALLOWED', 'Process'))
  if ([string]::IsNullOrWhiteSpace($adminOriginAllowed)) {
    $adminDomain = [string]([Environment]::GetEnvironmentVariable('ADMIN_DOMAIN', 'Process'))
    if (-not [string]::IsNullOrWhiteSpace($adminDomain)) {
      if ($adminDomain -match '^https?://') {
        $adminOriginAllowed = $adminDomain
      } else {
        $adminOriginAllowed = "http://$adminDomain"
      }
    } else {
      $adminOriginAllowed = 'http://admin.localhost'
    }
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')
  [Environment]::SetEnvironmentVariable('BILLING_MODE', $billingMode, 'Process')
  [Environment]::SetEnvironmentVariable('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', $adminOriginAllowed, 'Process')

  Write-Step "Running auth/access smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:auth-access:e2e
      Assert-LastExitCode "Auth/access smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'auth-access-smoke' -Status 'pass' -Details 'smoke:auth-access:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'auth-access-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-AdminProjectsSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_ADMIN_PROJECTS_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Admin projects smoke is disabled (set BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true to enable)."
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')

  Write-Step "Running admin projects rollout smoke..."
  Push-Location $RepoRoot
  try {
    pnpm run smoke:admin-projects:e2e
    Assert-LastExitCode "Admin projects rollout smoke"
  } finally {
    Pop-Location
  }
}

function Run-AdminRbacSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_ADMIN_RBAC_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Admin RBAC smoke is disabled (set BOTMOX_RUN_ADMIN_RBAC_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-rbac-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')

  Write-Step "Running admin RBAC smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:admin-rbac:e2e
      Assert-LastExitCode "Admin RBAC smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-rbac-smoke' -Status 'pass' -Details 'smoke:admin-rbac:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-rbac-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-AdminOriginSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_ADMIN_ORIGIN_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Admin origin smoke is disabled (set BOTMOX_RUN_ADMIN_ORIGIN_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-origin-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  $adminOriginAllowed = [string]([Environment]::GetEnvironmentVariable('BOTMOX_ADMIN_ORIGIN_SMOKE_ALLOWED', 'Process'))
  if ([string]::IsNullOrWhiteSpace($adminOriginAllowed)) {
    $adminDomain = [string]([Environment]::GetEnvironmentVariable('ADMIN_DOMAIN', 'Process'))
    if (-not [string]::IsNullOrWhiteSpace($adminDomain)) {
      if ($adminDomain -match '^https?://') {
        $adminOriginAllowed = $adminDomain
      } else {
        $adminOriginAllowed = "http://$adminDomain"
      }
    } else {
      $adminOriginAllowed = 'http://admin.localhost'
    }
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', $adminOriginAllowed, 'Process')

  Write-Step "Running admin origin policy smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:admin-origin:e2e
      Assert-LastExitCode "Admin origin policy smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-origin-smoke' -Status 'pass' -Details 'smoke:admin-origin:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'admin-origin-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-BillingAdminSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_BILLING_ADMIN_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Billing admin smoke is disabled (set BOTMOX_RUN_BILLING_ADMIN_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'billing-admin-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  $billingMode = [string]([Environment]::GetEnvironmentVariable('BILLING_MODE', 'Process'))
  if ([string]::IsNullOrWhiteSpace($billingMode)) {
    $billingMode = 'stub'
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')
  [Environment]::SetEnvironmentVariable('BILLING_MODE', $billingMode, 'Process')

  Write-Step "Running billing admin smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:billing-admin:e2e
      Assert-LastExitCode "Billing admin smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'billing-admin-smoke' -Status 'pass' -Details 'smoke:billing-admin:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'billing-admin-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-DataEncryptionSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_DATA_ENCRYPTION_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Data encryption smoke is disabled (set BOTMOX_RUN_DATA_ENCRYPTION_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'data-encryption-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  $adminOriginAllowed = [string]([Environment]::GetEnvironmentVariable('BOTMOX_ADMIN_ORIGIN_SMOKE_ALLOWED', 'Process'))
  if ([string]::IsNullOrWhiteSpace($adminOriginAllowed)) {
    $adminDomain = [string]([Environment]::GetEnvironmentVariable('ADMIN_DOMAIN', 'Process'))
    if (-not [string]::IsNullOrWhiteSpace($adminDomain)) {
      if ($adminDomain -match '^https?://') {
        $adminOriginAllowed = $adminDomain
      } else {
        $adminOriginAllowed = "http://$adminDomain"
      }
    } else {
      $adminOriginAllowed = 'http://admin.localhost'
    }
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')
  [Environment]::SetEnvironmentVariable('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', $adminOriginAllowed, 'Process')

  Write-Step "Running data encryption rotation smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:data-encryption:e2e
      Assert-LastExitCode "Data encryption rotation smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'data-encryption-smoke' -Status 'pass' -Details 'smoke:data-encryption:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'data-encryption-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-SettingsSurfaceSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_SETTINGS_SURFACE_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Settings surface smoke is disabled (set BOTMOX_RUN_SETTINGS_SURFACE_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'settings-surface-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')

  Write-Step "Running settings surface smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:settings-surface:e2e
      Assert-LastExitCode "Settings surface smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'settings-surface-smoke' -Status 'pass' -Details 'smoke:settings-surface:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'settings-surface-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-RuntimeMetricsRecord([string]$RepoRoot, [string]$BaseUrl) {
  $runRecord = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_RUNTIME_METRICS_RECORD', 'Process')))
  if (-not $runRecord) {
    Write-Step "Runtime metrics record is disabled (set BOTMOX_RUN_RUNTIME_METRICS_RECORD=true to enable)."
    return
  }

  $adminEmail = Resolve-AdminEmail
  $adminPassword = Resolve-AdminPassword
  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', $adminEmail, 'Process')
  [Environment]::SetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', $adminPassword, 'Process')

  Write-Step "Recording runtime metrics snapshot..."
  Push-Location $RepoRoot
  try {
    pnpm run hardening:runtime:record:strict
    Assert-LastExitCode "Runtime metrics record"
  } finally {
    Pop-Location
  }
}

function Run-TenantIsolationSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_TENANT_ISOLATION_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Tenant isolation smoke is disabled (set BOTMOX_RUN_TENANT_ISOLATION_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'tenant-isolation-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')

  Write-Step "Running tenant isolation smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:tenant-isolation:e2e
      Assert-LastExitCode "Tenant isolation smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'tenant-isolation-smoke' -Status 'pass' -Details 'smoke:tenant-isolation:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'tenant-isolation-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Run-AgentsTenantIsolationSmoke([string]$RepoRoot, [string]$BaseUrl) {
  $runSmoke = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE', 'Process')))
  if (-not $runSmoke) {
    Write-Step "Agents tenant isolation smoke is disabled (set BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE=true to enable)."
    Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'agents-tenant-isolation-smoke' -Status 'skipped' -Details 'disabled_by_flag'
    return
  }

  [Environment]::SetEnvironmentVariable('API_BASE_URL', $BaseUrl, 'Process')

  Write-Step "Running agents tenant isolation smoke..."
  Push-Location $RepoRoot
  try {
    try {
      pnpm run smoke:agents-tenant-isolation:e2e
      Assert-LastExitCode "Agents tenant isolation smoke"
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'agents-tenant-isolation-smoke' -Status 'pass' -Details 'smoke:agents-tenant-isolation:e2e'
    } catch {
      Write-SmokeAuditStatus -RepoRoot $RepoRoot -AuditName 'agents-tenant-isolation-smoke' -Status 'fail' -Details $_.Exception.Message
      throw
    }
  } finally {
    Pop-Location
  }
}

function Apply-DatabaseMigrations([string]$EnvFilePath) {
  Write-Step "Applying database migrations..."
  docker compose -f deploy/compose.stack.yml --env-file $EnvFilePath run --rm --no-deps supabase-app-migrate
  Assert-LastExitCode "Database migrations"
}

function Start-InfraServices([string]$EnvFilePath) {
  Write-Step "Starting infra foundation services first (db init + minio)..."
  docker compose -f deploy/compose.stack.yml --env-file $EnvFilePath up -d `
    supabase-db `
    minio `
    minio-init
  Assert-LastExitCode "Infra services startup"
}

function Wait-SupabaseDbInit([string]$EnvFilePath, [int]$TimeoutSeconds = 180) {
  Write-Step "Waiting for supabase-db-init to complete..."
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $containerId = [string]((& docker compose -f deploy/compose.stack.yml --env-file $EnvFilePath ps -q supabase-db-init | Out-String)).Trim()
    if ([string]::IsNullOrWhiteSpace($containerId)) {
      Start-Sleep -Seconds 2
      continue
    }

    $status = [string]((& docker inspect -f "{{.State.Status}}" $containerId | Out-String)).Trim()
    if ($status -eq 'exited') {
      $exitCodeRaw = [string]((& docker inspect -f "{{.State.ExitCode}}" $containerId | Out-String)).Trim()
      $exitCode = 1
      [void][int]::TryParse($exitCodeRaw, [ref]$exitCode)
      if ($exitCode -ne 0) {
        throw "supabase-db-init exited with code $exitCode"
      }
      Write-Step "supabase-db-init completed successfully."
      return
    }
    if ($status -eq 'running') {
      Start-Sleep -Seconds 2
      continue
    }
    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for supabase-db-init completion"
}

function Start-SupabaseApiServices([string]$EnvFilePath) {
  Write-Step "Starting supabase API services (auth/rest/storage/kong)..."
  docker compose -f deploy/compose.stack.yml --env-file $EnvFilePath up -d `
    supabase-auth `
    supabase-rest `
    supabase-storage `
    supabase-kong
  Assert-LastExitCode "Supabase API services startup"
}

function Start-AppServices([string]$EnvFilePath) {
  Write-Step "Starting app services (backend/frontend/admin/caddy)..."
  docker compose -f deploy/compose.stack.yml --env-file $EnvFilePath up -d --force-recreate `
    backend `
    frontend `
    admin `
    caddy
  Assert-LastExitCode "App services startup"
}

function Resolve-AdminEmail {
  $email = [string]([Environment]::GetEnvironmentVariable('BOTMOX_ADMIN_EMAIL', 'Process'))
  if (![string]::IsNullOrWhiteSpace($email)) {
    return $email
  }

  # Backward-compatible fallback for old bootstrap variable.
  $legacyBootstrapEmail = [string]([Environment]::GetEnvironmentVariable('BOTMOX_BOOTSTRAP_EMAIL', 'Process'))
  if (![string]::IsNullOrWhiteSpace($legacyBootstrapEmail)) {
    return $legacyBootstrapEmail
  }

  $adminAllowList = [string]([Environment]::GetEnvironmentVariable('SUPABASE_ADMIN_EMAILS', 'Process'))
  if (![string]::IsNullOrWhiteSpace($adminAllowList)) {
    $firstEmail = ($adminAllowList -split ',')[0].Trim()
    if (![string]::IsNullOrWhiteSpace($firstEmail)) {
      return $firstEmail
    }
  }

  return 'admin@localhost'
}

function Resolve-AdminPassword {
  $password = [string]([Environment]::GetEnvironmentVariable('BOTMOX_ADMIN_PASSWORD', 'Process'))
  if (![string]::IsNullOrWhiteSpace($password)) {
    return $password
  }

  # Backward-compatible fallback for old bootstrap variable.
  $legacyBootstrapPassword = [string]([Environment]::GetEnvironmentVariable('BOTMOX_BOOTSTRAP_PASSWORD', 'Process'))
  if (![string]::IsNullOrWhiteSpace($legacyBootstrapPassword)) {
    return $legacyBootstrapPassword
  }

  return 'BotmoxLocal234'
}

function Ensure-LocalOperator([string]$RepoRoot) {
  $ensureAdminRaw = [string]([Environment]::GetEnvironmentVariable('BOTMOX_BOOTSTRAP_ENSURE_ADMIN', 'Process'))
  $ensureAdmin = $ensureAdminRaw -match '^(1|true|yes|on)$'
  if (-not $ensureAdmin) {
    Write-Step "Admin bootstrap is disabled (BOTMOX_BOOTSTRAP_ENSURE_ADMIN != true). Using existing account only."
    return
  }

  $email = Resolve-AdminEmail
  $password = Resolve-AdminPassword

  $tenant = [string]([Environment]::GetEnvironmentVariable('BOTMOX_BOOTSTRAP_TENANT', 'Process'))
  if ([string]::IsNullOrWhiteSpace($tenant)) { $tenant = 'default' }

  $supabasePublicUrl = [string]([Environment]::GetEnvironmentVariable('SUPABASE_PUBLIC_URL', 'Process'))
  if ([string]::IsNullOrWhiteSpace($supabasePublicUrl)) { $supabasePublicUrl = 'http://localhost' }
  [Environment]::SetEnvironmentVariable('SUPABASE_PUBLIC_URL', $supabasePublicUrl, 'Process')

  $maxAttempts = 10
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $createOutput = & node scripts/supabase-create-user.js --email $email --password $password --tenant $tenant --roles "admin,user" 2>&1
    } finally {
      $ErrorActionPreference = $previousErrorAction
    }
    $exitCode = $LASTEXITCODE
    $outputText = (($createOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)

    if ($exitCode -eq 0) {
      Write-Step "Operator user is ready: $email"
      return
    }

    if ($outputText -match 'already been registered') {
      Write-Step "Operator user already exists: $email"
      return
    }

    $isTransient = ($outputText -match '(?i)fetch failed|ECONNREFUSED|ETIMEDOUT|upstream connect error|socket hang up')
    if (-not $isTransient -or $attempt -ge $maxAttempts) {
      throw "Failed to bootstrap operator user. Output: $outputText"
    }

    Write-Step "Operator bootstrap transient failure (attempt $attempt/$maxAttempts). Retrying in 3s..."
    Start-Sleep -Seconds 3
  }
}

function Start-AgentProcess([string]$RepoRoot) {
  $existingAgent = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -match 'electron(.exe)?$' -and $_.CommandLine -match 'Bot-Mox' } |
    Select-Object -First 1

  if ($null -ne $existingAgent) {
    Write-Step "Agent already running (PID=$($existingAgent.ProcessId))."
    return
  }

  $command = "cd /d `"$RepoRoot`" && pnpm run agent:dev > agent-dev.out.log 2> agent-dev.err.log"
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $command -PassThru
  Write-Step "Agent process started (PID=$($proc.Id))."
}

function Apply-StrictRuntimeProfile {
  $enforceStrict = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_ENFORCE_STRICT_FLAGS', 'Process')))
  if (-not $enforceStrict) {
    return
  }

  Write-Step "Applying strict runtime migration profile..."
  [Environment]::SetEnvironmentVariable('AUTH_MODE', 'enforced', 'Process')
  [Environment]::SetEnvironmentVariable('AGENT_TRANSPORT', 'ws', 'Process')
  [Environment]::SetEnvironmentVariable('SECRETS_VAULT_MODE', 'enforced', 'Process')
  [Environment]::SetEnvironmentVariable('TRIAL_DURATION_HOURS', '24', 'Process')
  [Environment]::SetEnvironmentVariable('BILLING_STUB_SELF_ACTIVATE', 'false', 'Process')
  [Environment]::SetEnvironmentVariable('ADMIN_ORIGIN_ENFORCEMENT', 'true', 'Process')
  [Environment]::SetEnvironmentVariable('ADMIN_ORIGIN_STRICT', 'true', 'Process')

  if ([string]::IsNullOrWhiteSpace([string]([Environment]::GetEnvironmentVariable('SUPABASE_VAULT_RPC_NAME', 'Process')))) {
    [Environment]::SetEnvironmentVariable('SUPABASE_VAULT_RPC_NAME', 'vault_store_secret', 'Process')
  }
  if ([string]::IsNullOrWhiteSpace([string]([Environment]::GetEnvironmentVariable('SUPABASE_VAULT_ROTATE_RPC_NAME', 'Process')))) {
    [Environment]::SetEnvironmentVariable('SUPABASE_VAULT_ROTATE_RPC_NAME', 'vault_rotate_secret', 'Process')
  }

  if ([string]::IsNullOrWhiteSpace([string]([Environment]::GetEnvironmentVariable('ADMIN_CORS_ORIGIN', 'Process')))) {
    [Environment]::SetEnvironmentVariable(
      'ADMIN_CORS_ORIGIN',
      'http://localhost:5174,http://127.0.0.1:5174,http://admin.localhost',
      'Process'
    )
  }
}

function Run-StrictMigrationChecks([string]$RepoRoot) {
  $enforceStrict = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_ENFORCE_STRICT_FLAGS', 'Process')))
  if (-not $enforceStrict) {
    return
  }

  Write-Step "Running strict migration flags check..."
  Push-Location $RepoRoot
  try {
    pnpm run migration:check:strict
    Assert-LastExitCode "Strict migration flags check"
  } finally {
    Pop-Location
  }
}

$repoRoot = Get-RepoRoot
$envFile = Get-EnvFilePath -RepoRoot $repoRoot

Push-Location $repoRoot
try {
  Import-EnvFile -EnvFilePath $envFile
  Apply-StrictRuntimeProfile
  Run-StrictMigrationChecks -RepoRoot $repoRoot

  $fullReset = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_STACK_FULL_RESET', 'Process')))
  $buildNoCache = Is-Truthy([string]([Environment]::GetEnvironmentVariable('BOTMOX_BUILD_NO_CACHE', 'Process')))

  Write-Step "Stopping previous stack (deterministic reset)..."
  $downArgs = @('compose', '-f', 'deploy/compose.stack.yml', '--env-file', $envFile, 'down', '--remove-orphans')
  if ($fullReset) {
    Write-Step "Full reset enabled: removing named volumes."
    $downArgs += '-v'
  }
  docker @downArgs
  Assert-LastExitCode "Stack down"

  Write-Step "Building production-like images (frontend + admin + backend)..."
  $frontendBuildArgs = @('build', '--pull', '-f', 'apps/frontend/Dockerfile', '-t', 'botmox/frontend:prod-sim')
  $adminBuildArgs = @('build', '--pull', '-f', 'apps/admin/Dockerfile', '-t', 'botmox/admin:prod-sim')
  $backendBuildArgs = @('build', '--pull', '-f', 'apps/backend/Dockerfile', '-t', 'botmox/backend:prod-sim')
  if ($buildNoCache) {
    Write-Step "No-cache build enabled."
    $frontendBuildArgs += '--no-cache'
    $adminBuildArgs += '--no-cache'
    $backendBuildArgs += '--no-cache'
  }
  $frontendBuildArgs += '.'
  $adminBuildArgs += '.'
  $backendBuildArgs += '.'
  docker @frontendBuildArgs
  Assert-LastExitCode "Frontend image build"
  docker @adminBuildArgs
  Assert-LastExitCode "Admin image build"
  docker @backendBuildArgs
  Assert-LastExitCode "Backend image build"

  Start-InfraServices -EnvFilePath $envFile

  Apply-DatabaseMigrations -EnvFilePath $envFile
  Start-SupabaseApiServices -EnvFilePath $envFile

  Start-AppServices -EnvFilePath $envFile

  Write-Step "Waiting for API health..."
  Wait-HttpReady -Url 'http://localhost/api/v1/health'
  Wait-HttpReady -Url 'http://localhost/api/v1/health/live'
  Wait-HttpReady -Url 'http://localhost/api/v1/health/ready'
  Write-Step "Waiting for UI health..."
  Wait-HttpReady -Url 'http://localhost'
  Write-Step "Waiting for Admin UI health..."
  Wait-AdminUiReady

  Write-Step "Bootstrapping local operator account..."
  Ensure-LocalOperator -RepoRoot $repoRoot

  Write-Step "Starting desktop agent..."
  Start-AgentProcess -RepoRoot $repoRoot

  Write-Step "Running doctor check..."
  [Environment]::SetEnvironmentVariable('BOTMOX_BASE_URL', 'http://localhost', 'Process')
  pnpm run doctor
  Assert-LastExitCode "Doctor check"

  Run-AuthAccessSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-AdminOriginSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-AdminRbacSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-TenantIsolationSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-AgentsTenantIsolationSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-AdminProjectsSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-BillingAdminSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-DataEncryptionSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-SettingsSurfaceSmoke -RepoRoot $repoRoot -BaseUrl 'http://localhost'
  Run-RuntimeMetricsRecord -RepoRoot $repoRoot -BaseUrl 'http://localhost'

  Write-Step "Done."
  Write-Host ""
  Write-Host "UI: http://localhost"
  Write-Host "Admin UI: http://admin.localhost"
  Write-Host "API: http://localhost/api/v1/health"
  $finalEmail = Resolve-AdminEmail
  $finalPassword = Resolve-AdminPassword
  Write-Host "Default operator login: $finalEmail"
  Write-Host "Default operator password: $finalPassword"
} finally {
  Pop-Location
}
