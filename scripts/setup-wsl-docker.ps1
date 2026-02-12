Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[setup] $Message" -ForegroundColor Cyan
}

function Ensure-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell (Administrator)."
  }
}

function Enable-Feature([string]$FeatureName) {
  Write-Step "Enabling Windows feature: $FeatureName"
  dism /online /enable-feature /featurename:$FeatureName /all /norestart | Out-Host
}

function Set-HypervisorAutoStart {
  Write-Step "Setting hypervisorlaunchtype=Auto"
  bcdedit /set hypervisorlaunchtype Auto | Out-Host
}

function Install-WslCore {
  Write-Step "Installing WSL core components (without distro)"
  wsl --install --no-distribution | Out-Host
}

function Set-Wsl2Default {
  Write-Step "Setting WSL default version to 2"
  wsl --set-default-version 2 | Out-Host
}

function Show-PostSteps {
  Write-Host ""
  Write-Host "Completed. Reboot Windows now." -ForegroundColor Green
  Write-Host "After reboot run:" -ForegroundColor Yellow
  Write-Host "  wsl --status"
  Write-Host "  docker version"
  Write-Host "Then return to Codex and I will continue Supabase bootstrap." -ForegroundColor Yellow
}

try {
  Ensure-Admin
  Enable-Feature -FeatureName 'Microsoft-Windows-Subsystem-Linux'
  Enable-Feature -FeatureName 'VirtualMachinePlatform'
  Enable-Feature -FeatureName 'Windows-Hypervisor-Platform'
  Enable-Feature -FeatureName 'Microsoft-Hyper-V-All'
  Set-HypervisorAutoStart
  Install-WslCore
  Set-Wsl2Default
  Show-PostSteps
} catch {
  Write-Host ""
  Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
