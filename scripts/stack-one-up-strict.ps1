param(
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[stack-one-up-strict] $Message"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$baseScript = Join-Path $PSScriptRoot 'stack-one-up.ps1'

if (!(Test-Path $baseScript)) {
  throw "Missing base script: $baseScript"
}

[Environment]::SetEnvironmentVariable('BOTMOX_STACK_FULL_RESET', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_BUILD_NO_CACHE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_AUTH_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_ADMIN_ORIGIN_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_ADMIN_RBAC_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_TENANT_ISOLATION_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_ADMIN_PROJECTS_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_BILLING_ADMIN_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_DATA_ENCRYPTION_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_SETTINGS_SURFACE_SMOKE', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_RUN_RUNTIME_METRICS_RECORD', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_ENFORCE_STRICT_FLAGS', 'true', 'Process')
[Environment]::SetEnvironmentVariable('BOTMOX_BOOTSTRAP_ENSURE_ADMIN', 'true', 'Process')

Write-Step "Strict profile enabled:"
Write-Host "  BOTMOX_STACK_FULL_RESET=true"
Write-Host "  BOTMOX_BUILD_NO_CACHE=true"
Write-Host "  BOTMOX_RUN_AUTH_SMOKE=true"
Write-Host "  BOTMOX_RUN_ADMIN_ORIGIN_SMOKE=true"
Write-Host "  BOTMOX_RUN_ADMIN_RBAC_SMOKE=true"
Write-Host "  BOTMOX_RUN_TENANT_ISOLATION_SMOKE=true"
Write-Host "  BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE=true"
Write-Host "  BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true"
Write-Host "  BOTMOX_RUN_BILLING_ADMIN_SMOKE=true"
Write-Host "  BOTMOX_RUN_DATA_ENCRYPTION_SMOKE=true"
Write-Host "  BOTMOX_RUN_SETTINGS_SURFACE_SMOKE=true"
Write-Host "  BOTMOX_RUN_RUNTIME_METRICS_RECORD=true"
Write-Host "  BOTMOX_ENFORCE_STRICT_FLAGS=true"
Write-Host "  BOTMOX_BOOTSTRAP_ENSURE_ADMIN=true"
Write-Host "  (runtime strict profile enforces: TRIAL_DURATION_HOURS=24, BILLING_STUB_SELF_ACTIVATE=false)"

if ($DryRun) {
  Write-Step "Dry-run mode: base startup script not executed."
  exit 0
}

Push-Location $repoRoot
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $baseScript
  if ($LASTEXITCODE -ne 0) {
    throw "Base startup script failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
