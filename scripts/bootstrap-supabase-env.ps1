Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[supabase-bootstrap] $Message" -ForegroundColor Cyan
}

function Ensure-File([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }
}

function Set-Or-AppendEnv([string]$FilePath, [string]$Key, [string]$Value) {
  $lines = @()
  if (Test-Path $FilePath) {
    $lines = Get-Content -Path $FilePath
  }

  $escapedKey = [Regex]::Escape($Key)
  $pattern = "^\s*$escapedKey\s*="
  $updated = $false

  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    if ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -ne '') {
      $lines += ''
    }
    $lines += "$Key=$Value"
  }

  Set-Content -Path $FilePath -Value $lines -Encoding UTF8
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envPath = Join-Path $repoRoot 'proxy-server/.env'

Write-Step 'Ensuring Supabase stack is running...'
Push-Location $repoRoot
try {
  npx supabase start | Out-Host
  $statusJsonRaw = npx supabase status -o json
  $statusJsonText = ($statusJsonRaw -join [Environment]::NewLine)
  $status = $statusJsonText | ConvertFrom-Json
} finally {
  Pop-Location
}

$apiUrl = ([string]$status.API_URL).Trim()
$serviceRoleKey = ([string]$status.SERVICE_ROLE_KEY).Trim()

if (-not $apiUrl) {
  throw 'Could not parse API_URL from `supabase status -o json`.'
}
if (-not $serviceRoleKey) {
  throw 'Could not parse SERVICE_ROLE_KEY from `supabase status -o json`.'
}

Ensure-File -Path $envPath
Set-Or-AppendEnv -FilePath $envPath -Key 'DATA_BACKEND' -Value 'supabase'
Set-Or-AppendEnv -FilePath $envPath -Key 'SUPABASE_URL' -Value $apiUrl
Set-Or-AppendEnv -FilePath $envPath -Key 'SUPABASE_SERVICE_ROLE_KEY' -Value $serviceRoleKey

Write-Step "Updated: $envPath"
Write-Step "DATA_BACKEND=supabase"
Write-Step "SUPABASE_URL=$apiUrl"
Write-Step 'SUPABASE_SERVICE_ROLE_KEY=***'
Write-Host 'Done.' -ForegroundColor Green
