param(
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[stack-one-up-strict-full] $Message"
}

function Ensure-Directory([string]$Path) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Read-KeyValueFile([string]$Path) {
  $map = @{}
  if (!(Test-Path $Path)) {
    return $map
  }
  foreach ($line in (Get-Content -Path $Path -ErrorAction SilentlyContinue)) {
    $trimmed = [string]$line
    if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
    $trimmed = $trimmed.Trim()
    if ($trimmed.StartsWith('[')) { continue }
    $idx = $trimmed.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()
    if (-not [string]::IsNullOrWhiteSpace($key)) {
      $map[$key] = $value
    }
  }
  return $map
}

function Test-HttpOk([string]$Url, [hashtable]$Headers = @{}) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5 -Headers $Headers
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    return $false
  }
}

function Get-EnvCsvSet([string]$Name) {
  $raw = [string]([Environment]::GetEnvironmentVariable($Name, 'Process'))
  $set = @{}
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $set
  }
  foreach ($part in ($raw -split ',')) {
    $item = [string]$part
    if ([string]::IsNullOrWhiteSpace($item)) { continue }
    $normalized = $item.Trim().ToLowerInvariant()
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
      $set[$normalized] = $true
    }
  }
  return $set
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$strictScript = Join-Path $PSScriptRoot 'stack-one-up-strict.ps1'

if (!(Test-Path $strictScript)) {
  throw "Missing strict script: $strictScript"
}

[Environment]::SetEnvironmentVariable('BOTMOX_RUN_ADMIN_PROJECTS_SMOKE', 'true', 'Process')
Write-Step "Full strict profile enabled:"
Write-Host "  BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true"

Push-Location $repoRoot
try {
  $args = @()
  if ($DryRun) {
    $args += '-DryRun'
  }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $strictScript @args
  if ($LASTEXITCODE -ne 0) {
    throw "Strict startup script failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if ($DryRun) {
  Write-Step "Dry-run completed."
  exit 0
}

$uiOk = Test-HttpOk -Url 'http://localhost'
$apiOk = Test-HttpOk -Url 'http://localhost/api/v1/health'
$adminOk = Test-HttpOk -Url 'http://localhost' -Headers @{ Host = 'admin.localhost' }
$status = if ($uiOk -and $apiOk -and $adminOk) { 'READY' } else { 'DEGRADED' }
$timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$auditsDir = Join-Path $repoRoot 'docs/audits'
$latestReportPath = Join-Path $auditsDir 'stack-up-latest.txt'
$timestampedReportPath = Join-Path $auditsDir "stack-up-$timestamp.txt"

$composePsOutput = ''
try {
  $composePsOutput = (& docker compose -f (Join-Path $repoRoot 'deploy/compose.stack.yml') ps 2>&1 | Out-String)
} catch {
  $composePsOutput = "docker compose ps failed: $($_.Exception.Message)"
}

$runtimeMetricsAuditLatestPath = Join-Path $repoRoot 'docs/audits/production-hardening-runtime-metrics-latest.md'
$runtimeMetricsMonthlyAudit = ''
try {
  $runtimeMetricsMonthlyAudit = [string]((& Get-ChildItem -Path (Join-Path $repoRoot 'docs/audits') -Filter 'production-hardening-runtime-metrics-*.md' -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1 -ExpandProperty FullName) 2>$null)
} catch {
  $runtimeMetricsMonthlyAudit = ''
}
$runtimeMetricsMonthlyAudit = $runtimeMetricsMonthlyAudit.Trim()

$reportLines = @(
  "timestamp=$([DateTime]::UtcNow.ToString('o'))"
  "stack_status=$status"
  "ui_health=$uiOk"
  "api_health=$apiOk"
  "admin_health=$adminOk"
  "start_command=pnpm run stack:up"
  "runtime_metrics_audit_latest_exists=$(Test-Path $runtimeMetricsAuditLatestPath)"
  "runtime_metrics_audit_latest_path=$runtimeMetricsAuditLatestPath"
  "runtime_metrics_audit_monthly_path=$runtimeMetricsMonthlyAudit"
  ""
  "[docker_compose_ps]"
  $composePsOutput.TrimEnd()
)

try {
  Ensure-Directory -Path $auditsDir
  Set-Content -Path $latestReportPath -Value $reportLines -Encoding UTF8
  Set-Content -Path $timestampedReportPath -Value $reportLines -Encoding UTF8
} catch {
  Write-Step "Warning: failed to write stack status report: $($_.Exception.Message)"
}

$postStartDiagnosticsLatest = Join-Path $auditsDir 'post-start-diagnostics-latest.txt'
$postStartKv = @{}
try {
  Push-Location $repoRoot
  try {
    & node scripts/post-start-diagnostics-summary.js | Out-Host
  } finally {
    Pop-Location
  }
  $postStartKv = Read-KeyValueFile -Path $postStartDiagnosticsLatest
} catch {
  Write-Step "Warning: failed to build post-start diagnostics summary: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== BOTMOX STACK STATUS ==="
Write-Host "STACK_STATUS=$status"
Write-Host "UI_HEALTH=$uiOk (http://localhost)"
Write-Host "API_HEALTH=$apiOk (http://localhost/api/v1/health)"
Write-Host "ADMIN_HEALTH=$adminOk (http://admin.localhost via Host header)"
Write-Host "START_COMMAND=pnpm run stack:up"
Write-Host "RUNTIME_METRICS_AUDIT_LATEST_EXISTS=$(Test-Path $runtimeMetricsAuditLatestPath)"
Write-Host "RUNTIME_METRICS_AUDIT_LATEST_PATH=$runtimeMetricsAuditLatestPath"
if (-not [string]::IsNullOrWhiteSpace($runtimeMetricsMonthlyAudit)) {
  Write-Host "RUNTIME_METRICS_AUDIT_MONTHLY_PATH=$runtimeMetricsMonthlyAudit"
}
Write-Host "POST_START_DIAGNOSTICS_LATEST=$postStartDiagnosticsLatest"
if ($postStartKv.ContainsKey('diagnostics_verdict')) {
  Write-Host "POST_START_DIAGNOSTICS_VERDICT=$($postStartKv['diagnostics_verdict'])"
}
if ($postStartKv.ContainsKey('post_start_severity')) {
  Write-Host "POST_START_SEVERITY=$($postStartKv['post_start_severity'])"
}
if ($postStartKv.ContainsKey('post_start_summary_line')) {
  Write-Host "POST_START_SUMMARY_LINE=$($postStartKv['post_start_summary_line'])"
}
if ($postStartKv.ContainsKey('startup_runtime_correlation_mode')) {
  Write-Host "STARTUP_RUNTIME_CORRELATION_MODE=$($postStartKv['startup_runtime_correlation_mode'])"
}
if ($postStartKv.ContainsKey('startup_runtime_correlation_startup_gate')) {
  Write-Host "STARTUP_RUNTIME_CORRELATION_STARTUP_GATE=$($postStartKv['startup_runtime_correlation_startup_gate'])"
}
if ($postStartKv.ContainsKey('startup_runtime_correlation_runtime_gate')) {
  Write-Host "STARTUP_RUNTIME_CORRELATION_RUNTIME_GATE=$($postStartKv['startup_runtime_correlation_runtime_gate'])"
}
if ($postStartKv.ContainsKey('startup_runtime_correlation_reason_codes')) {
  Write-Host "STARTUP_RUNTIME_CORRELATION_REASON_CODES=$($postStartKv['startup_runtime_correlation_reason_codes'])"
}
if ($postStartKv.ContainsKey('startup_runtime_correlation_summary_line')) {
  Write-Host "STARTUP_RUNTIME_CORRELATION_SUMMARY_LINE=$($postStartKv['startup_runtime_correlation_summary_line'])"
}
if ($postStartKv.ContainsKey('diagnostics_reason_codes')) {
  Write-Host "POST_START_DIAGNOSTICS_REASON_CODES=$($postStartKv['diagnostics_reason_codes'])"
}
if ($postStartKv.ContainsKey('diagnostics_reason_levels')) {
  Write-Host "POST_START_DIAGNOSTICS_REASON_LEVELS=$($postStartKv['diagnostics_reason_levels'])"
}
if ($postStartKv.ContainsKey('readiness_gate')) {
  Write-Host "READINESS_GATE=$($postStartKv['readiness_gate'])"
}
if ($postStartKv.ContainsKey('readiness_reason_codes')) {
  Write-Host "READINESS_REASON_CODES=$($postStartKv['readiness_reason_codes'])"
}
if ($postStartKv.ContainsKey('runtime_gate')) {
  Write-Host "RUNTIME_GATE=$($postStartKv['runtime_gate'])"
}
if ($postStartKv.ContainsKey('runtime_reason_codes')) {
  Write-Host "RUNTIME_REASON_CODES=$($postStartKv['runtime_reason_codes'])"
}
if ($postStartKv.ContainsKey('runtime_hotspot_gate')) {
  Write-Host "RUNTIME_HOTSPOT_GATE=$($postStartKv['runtime_hotspot_gate'])"
}
if ($postStartKv.ContainsKey('runtime_hotspot_flags')) {
  Write-Host "RUNTIME_HOTSPOT_FLAGS=$($postStartKv['runtime_hotspot_flags'])"
}
if ($postStartKv.ContainsKey('runtime_hotspot_fail_flags')) {
  Write-Host "RUNTIME_HOTSPOT_FAIL_FLAGS=$($postStartKv['runtime_hotspot_fail_flags'])"
}
if ($postStartKv.ContainsKey('runtime_trend_gate')) {
  Write-Host "RUNTIME_TREND_GATE=$($postStartKv['runtime_trend_gate'])"
}
if ($postStartKv.ContainsKey('runtime_trend_reason_codes')) {
  Write-Host "RUNTIME_TREND_REASON_CODES=$($postStartKv['runtime_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('runtime_trend_summary_line')) {
  Write-Host "RUNTIME_TREND_SUMMARY_LINE=$($postStartKv['runtime_trend_summary_line'])"
}
if ($postStartKv.ContainsKey('agent_flow_gate')) {
  Write-Host "AGENT_FLOW_GATE=$($postStartKv['agent_flow_gate'])"
}
if ($postStartKv.ContainsKey('agent_flow_reason_codes')) {
  Write-Host "AGENT_FLOW_REASON_CODES=$($postStartKv['agent_flow_reason_codes'])"
}
if ($postStartKv.ContainsKey('agent_flow_summary_line')) {
  Write-Host "AGENT_FLOW_SUMMARY_LINE=$($postStartKv['agent_flow_summary_line'])"
}
if ($postStartKv.ContainsKey('agent_flow_trend_gate')) {
  Write-Host "AGENT_FLOW_TREND_GATE=$($postStartKv['agent_flow_trend_gate'])"
}
if ($postStartKv.ContainsKey('agent_flow_trend_reason_codes')) {
  Write-Host "AGENT_FLOW_TREND_REASON_CODES=$($postStartKv['agent_flow_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('agent_flow_trend_summary_line')) {
  Write-Host "AGENT_FLOW_TREND_SUMMARY_LINE=$($postStartKv['agent_flow_trend_summary_line'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_gate')) {
  Write-Host "VMOPS_SSE_FLOW_GATE=$($postStartKv['vmops_sse_flow_gate'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_reason_codes')) {
  Write-Host "VMOPS_SSE_FLOW_REASON_CODES=$($postStartKv['vmops_sse_flow_reason_codes'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_summary_line')) {
  Write-Host "VMOPS_SSE_FLOW_SUMMARY_LINE=$($postStartKv['vmops_sse_flow_summary_line'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_trend_gate')) {
  Write-Host "VMOPS_SSE_FLOW_TREND_GATE=$($postStartKv['vmops_sse_flow_trend_gate'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_trend_reason_codes')) {
  Write-Host "VMOPS_SSE_FLOW_TREND_REASON_CODES=$($postStartKv['vmops_sse_flow_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('vmops_sse_flow_trend_summary_line')) {
  Write-Host "VMOPS_SSE_FLOW_TREND_SUMMARY_LINE=$($postStartKv['vmops_sse_flow_trend_summary_line'])"
}
if ($postStartKv.ContainsKey('stack_trend_gate')) {
  Write-Host "STACK_TREND_GATE=$($postStartKv['stack_trend_gate'])"
}
if ($postStartKv.ContainsKey('stack_trend_reason_codes')) {
  Write-Host "STACK_TREND_REASON_CODES=$($postStartKv['stack_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('stack_trend_summary_line')) {
  Write-Host "STACK_TREND_SUMMARY_LINE=$($postStartKv['stack_trend_summary_line'])"
}
if ($postStartKv.ContainsKey('smoke_trend_gate')) {
  Write-Host "SMOKE_TREND_GATE=$($postStartKv['smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('smoke_trend_reason_codes')) {
  Write-Host "SMOKE_TREND_REASON_CODES=$($postStartKv['smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('smoke_trend_info_codes')) {
  Write-Host "SMOKE_TREND_INFO_CODES=$($postStartKv['smoke_trend_info_codes'])"
}
if ($postStartKv.ContainsKey('smoke_trend_summary_line')) {
  Write-Host "SMOKE_TREND_SUMMARY_LINE=$($postStartKv['smoke_trend_summary_line'])"
}
if ($postStartKv.ContainsKey('tenant_isolation_smoke_gate')) {
  Write-Host "TENANT_ISOLATION_SMOKE_GATE=$($postStartKv['tenant_isolation_smoke_gate'])"
}
if ($postStartKv.ContainsKey('tenant_isolation_smoke_reason_codes')) {
  Write-Host "TENANT_ISOLATION_SMOKE_REASON_CODES=$($postStartKv['tenant_isolation_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('agents_tenant_isolation_smoke_gate')) {
  Write-Host "AGENTS_TENANT_ISOLATION_SMOKE_GATE=$($postStartKv['agents_tenant_isolation_smoke_gate'])"
}
if ($postStartKv.ContainsKey('agents_tenant_isolation_smoke_reason_codes')) {
  Write-Host "AGENTS_TENANT_ISOLATION_SMOKE_REASON_CODES=$($postStartKv['agents_tenant_isolation_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('tenant_isolation_smoke_summary_line')) {
  Write-Host "TENANT_ISOLATION_SMOKE_SUMMARY_LINE=$($postStartKv['tenant_isolation_smoke_summary_line'])"
}
if ($postStartKv.ContainsKey('source.tenant_isolation_smoke')) {
  Write-Host "TENANT_ISOLATION_SMOKE_SOURCE=$($postStartKv['source.tenant_isolation_smoke'])"
}
if ($postStartKv.ContainsKey('source.agents_tenant_isolation_smoke')) {
  Write-Host "AGENTS_TENANT_ISOLATION_SMOKE_SOURCE=$($postStartKv['source.agents_tenant_isolation_smoke'])"
}
if ($postStartKv.ContainsKey('source.auth_access_smoke')) {
  Write-Host "AUTH_ACCESS_SMOKE_SOURCE=$($postStartKv['source.auth_access_smoke'])"
}
if ($postStartKv.ContainsKey('source.settings_surface_smoke')) {
  Write-Host "SETTINGS_SURFACE_SMOKE_SOURCE=$($postStartKv['source.settings_surface_smoke'])"
}
if ($postStartKv.ContainsKey('source.admin_rbac_smoke')) {
  Write-Host "ADMIN_RBAC_SMOKE_SOURCE=$($postStartKv['source.admin_rbac_smoke'])"
}
if ($postStartKv.ContainsKey('source.admin_origin_smoke')) {
  Write-Host "ADMIN_ORIGIN_SMOKE_SOURCE=$($postStartKv['source.admin_origin_smoke'])"
}
if ($postStartKv.ContainsKey('source.billing_admin_smoke')) {
  Write-Host "BILLING_ADMIN_SMOKE_SOURCE=$($postStartKv['source.billing_admin_smoke'])"
}
if ($postStartKv.ContainsKey('source.data_encryption_smoke')) {
  Write-Host "DATA_ENCRYPTION_SMOKE_SOURCE=$($postStartKv['source.data_encryption_smoke'])"
}
if ($postStartKv.ContainsKey('tenant_isolation_smoke_trend_gate')) {
  Write-Host "TENANT_ISOLATION_SMOKE_TREND_GATE=$($postStartKv['tenant_isolation_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('tenant_isolation_smoke_trend_reason_codes')) {
  Write-Host "TENANT_ISOLATION_SMOKE_TREND_REASON_CODES=$($postStartKv['tenant_isolation_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('agents_tenant_isolation_smoke_trend_gate')) {
  Write-Host "AGENTS_TENANT_ISOLATION_SMOKE_TREND_GATE=$($postStartKv['agents_tenant_isolation_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('agents_tenant_isolation_smoke_trend_reason_codes')) {
  Write-Host "AGENTS_TENANT_ISOLATION_SMOKE_TREND_REASON_CODES=$($postStartKv['agents_tenant_isolation_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('auth_access_smoke_gate')) {
  Write-Host "AUTH_ACCESS_SMOKE_GATE=$($postStartKv['auth_access_smoke_gate'])"
}
if ($postStartKv.ContainsKey('auth_access_smoke_reason_codes')) {
  Write-Host "AUTH_ACCESS_SMOKE_REASON_CODES=$($postStartKv['auth_access_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('auth_access_smoke_trend_gate')) {
  Write-Host "AUTH_ACCESS_SMOKE_TREND_GATE=$($postStartKv['auth_access_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('auth_access_smoke_trend_reason_codes')) {
  Write-Host "AUTH_ACCESS_SMOKE_TREND_REASON_CODES=$($postStartKv['auth_access_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('settings_surface_smoke_gate')) {
  Write-Host "SETTINGS_SURFACE_SMOKE_GATE=$($postStartKv['settings_surface_smoke_gate'])"
}
if ($postStartKv.ContainsKey('settings_surface_smoke_reason_codes')) {
  Write-Host "SETTINGS_SURFACE_SMOKE_REASON_CODES=$($postStartKv['settings_surface_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('settings_surface_smoke_trend_gate')) {
  Write-Host "SETTINGS_SURFACE_SMOKE_TREND_GATE=$($postStartKv['settings_surface_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('settings_surface_smoke_trend_reason_codes')) {
  Write-Host "SETTINGS_SURFACE_SMOKE_TREND_REASON_CODES=$($postStartKv['settings_surface_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('admin_rbac_smoke_gate')) {
  Write-Host "ADMIN_RBAC_SMOKE_GATE=$($postStartKv['admin_rbac_smoke_gate'])"
}
if ($postStartKv.ContainsKey('admin_rbac_smoke_reason_codes')) {
  Write-Host "ADMIN_RBAC_SMOKE_REASON_CODES=$($postStartKv['admin_rbac_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('admin_rbac_smoke_trend_gate')) {
  Write-Host "ADMIN_RBAC_SMOKE_TREND_GATE=$($postStartKv['admin_rbac_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('admin_rbac_smoke_trend_reason_codes')) {
  Write-Host "ADMIN_RBAC_SMOKE_TREND_REASON_CODES=$($postStartKv['admin_rbac_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('admin_origin_smoke_gate')) {
  Write-Host "ADMIN_ORIGIN_SMOKE_GATE=$($postStartKv['admin_origin_smoke_gate'])"
}
if ($postStartKv.ContainsKey('admin_origin_smoke_reason_codes')) {
  Write-Host "ADMIN_ORIGIN_SMOKE_REASON_CODES=$($postStartKv['admin_origin_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('admin_origin_smoke_trend_gate')) {
  Write-Host "ADMIN_ORIGIN_SMOKE_TREND_GATE=$($postStartKv['admin_origin_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('admin_origin_smoke_trend_reason_codes')) {
  Write-Host "ADMIN_ORIGIN_SMOKE_TREND_REASON_CODES=$($postStartKv['admin_origin_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('billing_admin_smoke_gate')) {
  Write-Host "BILLING_ADMIN_SMOKE_GATE=$($postStartKv['billing_admin_smoke_gate'])"
}
if ($postStartKv.ContainsKey('billing_admin_smoke_reason_codes')) {
  Write-Host "BILLING_ADMIN_SMOKE_REASON_CODES=$($postStartKv['billing_admin_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('billing_admin_smoke_trend_gate')) {
  Write-Host "BILLING_ADMIN_SMOKE_TREND_GATE=$($postStartKv['billing_admin_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('billing_admin_smoke_trend_reason_codes')) {
  Write-Host "BILLING_ADMIN_SMOKE_TREND_REASON_CODES=$($postStartKv['billing_admin_smoke_trend_reason_codes'])"
}
if ($postStartKv.ContainsKey('data_encryption_smoke_gate')) {
  Write-Host "DATA_ENCRYPTION_SMOKE_GATE=$($postStartKv['data_encryption_smoke_gate'])"
}
if ($postStartKv.ContainsKey('data_encryption_smoke_reason_codes')) {
  Write-Host "DATA_ENCRYPTION_SMOKE_REASON_CODES=$($postStartKv['data_encryption_smoke_reason_codes'])"
}
if ($postStartKv.ContainsKey('data_encryption_smoke_trend_gate')) {
  Write-Host "DATA_ENCRYPTION_SMOKE_TREND_GATE=$($postStartKv['data_encryption_smoke_trend_gate'])"
}
if ($postStartKv.ContainsKey('data_encryption_smoke_trend_reason_codes')) {
  Write-Host "DATA_ENCRYPTION_SMOKE_TREND_REASON_CODES=$($postStartKv['data_encryption_smoke_trend_reason_codes'])"
}
Write-Host "STATUS_REPORT_LATEST=$latestReportPath"
Write-Host "STATUS_REPORT_TIMESTAMPED=$timestampedReportPath"
Write-Host "==========================="

$failModesSet = Get-EnvCsvSet -Name 'BOTMOX_STRICT_FULL_FAIL_ON_CORRELATION_MODES'
$failSeveritiesSet = Get-EnvCsvSet -Name 'BOTMOX_STRICT_FULL_FAIL_ON_POST_START_SEVERITIES'
$strictFailReasons = @()

$correlationMode = ''
if ($postStartKv.ContainsKey('startup_runtime_correlation_mode')) {
  $correlationMode = [string]$postStartKv['startup_runtime_correlation_mode']
}
$postStartSeverity = ''
if ($postStartKv.ContainsKey('post_start_severity')) {
  $postStartSeverity = [string]$postStartKv['post_start_severity']
}

if ($failModesSet.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($correlationMode)) {
  $modeKey = $correlationMode.Trim().ToLowerInvariant()
  if ($failModesSet.ContainsKey($modeKey)) {
    $strictFailReasons += "correlation_mode=$correlationMode"
  }
}

if ($failSeveritiesSet.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($postStartSeverity)) {
  $severityKey = $postStartSeverity.Trim().ToLowerInvariant()
  if ($failSeveritiesSet.ContainsKey($severityKey)) {
    $strictFailReasons += "post_start_severity=$postStartSeverity"
  }
}

if ($failModesSet.Count -gt 0 -or $failSeveritiesSet.Count -gt 0) {
  $configuredModes = if ($failModesSet.Count -gt 0) { ($failModesSet.Keys -join ',') } else { 'none' }
  $configuredSeverities = if ($failSeveritiesSet.Count -gt 0) { ($failSeveritiesSet.Keys -join ',') } else { 'none' }
  Write-Host "STRICT_FAIL_POLICY_ENABLED=true"
  Write-Host "STRICT_FAIL_POLICY_CORRELATION_MODES=$configuredModes"
  Write-Host "STRICT_FAIL_POLICY_POST_START_SEVERITIES=$configuredSeverities"
  if ($strictFailReasons.Count -gt 0) {
    Write-Host "STRICT_FAIL_POLICY_MATCH=true"
    Write-Host "STRICT_FAIL_POLICY_MATCH_REASONS=$($strictFailReasons -join ';')"
    exit 1
  }
  Write-Host "STRICT_FAIL_POLICY_MATCH=false"
} else {
  Write-Host "STRICT_FAIL_POLICY_ENABLED=false"
}
