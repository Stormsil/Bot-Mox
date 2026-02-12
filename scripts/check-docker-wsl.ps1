Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

function Write-Ok([string]$Message) { Write-Host "[ok]  $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[warn] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "[fail] $Message" -ForegroundColor Red }

Write-Host "Docker/WSL readiness check" -ForegroundColor Cyan
Write-Host ""

try {
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,VirtualizationFirmwareEnabled,VMMonitorModeExtensions,SecondLevelAddressTranslationExtensions
  if ($cpu.VirtualizationFirmwareEnabled) { Write-Ok "CPU virtualization firmware flag: ON" } else { Write-Fail "CPU virtualization firmware flag: OFF" }
  if ($cpu.VMMonitorModeExtensions) { Write-Ok "VM Monitor Mode Extensions: ON" } else { Write-Warn "VM Monitor Mode Extensions: OFF" }
  if ($cpu.SecondLevelAddressTranslationExtensions) { Write-Ok "SLAT: ON" } else { Write-Warn "SLAT: OFF" }
} catch {
  Write-Warn "Could not read CPU virtualization flags: $($_.Exception.Message)"
}

try {
  $wslStatus = wsl --status 2>&1
  $text = ($wslStatus | Out-String)
  if ($LASTEXITCODE -eq 0 -and $text.Trim()) {
    Write-Ok "WSL command is available"
  } else {
    Write-Fail "WSL command returned errors"
  }
} catch {
  Write-Fail "WSL is not available: $($_.Exception.Message)"
}

try {
  & 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' version 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "Docker daemon is reachable"
  } else {
    Write-Fail "Docker daemon is not reachable"
  }
} catch {
  Write-Fail "Docker CLI not found or daemon unavailable"
}

Write-Host ""
Write-Host "If Docker daemon is not reachable:" -ForegroundColor Cyan
Write-Host "1) Run scripts/setup-wsl-docker.ps1 in elevated PowerShell"
Write-Host "2) Reboot Windows"
Write-Host "3) Start Docker Desktop and re-run this check"

