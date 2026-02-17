'use strict';

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function randomWindowsUsername() {
  const adjectives = [
    'Quick', 'Silent', 'Brave', 'Clever', 'Sharp', 'Bold', 'Keen', 'Swift',
    'Lucky', 'Noble', 'Calm', 'Warm', 'Cool', 'Grand', 'Prime', 'Fair',
  ];
  const nouns = [
    'Fox', 'Hawk', 'Wolf', 'Bear', 'Lynx', 'Deer', 'Sage', 'Oak',
    'Elm', 'Pine', 'Star', 'Moon', 'Dawn', 'Ash', 'Jay', 'Wren',
  ];
  const adj = adjectives[crypto.randomInt(adjectives.length)];
  const noun = nouns[crypto.randomInt(nouns.length)];
  const num = crypto.randomInt(10, 99);
  return `${adj}${noun}${num}`;
}

function randomComputerName() {
  const prefix = 'DESKTOP-';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 7; i++) {
    suffix += chars[crypto.randomInt(chars.length)];
  }
  return prefix + suffix;
}

function resolveUsername(userConfig) {
  const mode = String(userConfig?.nameMode || 'random');
  let base;
  if (mode === 'custom' && userConfig?.customName) {
    base = String(userConfig.customName).trim();
  } else if (mode === 'fixed') {
    base = 'User';
  } else {
    base = randomWindowsUsername();
  }

  // apply suffix
  const suffix = String(userConfig?.customNameSuffix || 'none');
  if (mode === 'custom' && suffix === 'random_digits') {
    const digits = crypto.randomInt(2, 5); // 2-4 digits
    let digitStr = '';
    for (let i = 0; i < digits; i++) {
      digitStr += crypto.randomInt(10);
    }
    return base + digitStr;
  }
  // 'sequential' is handled by caller (pass index), 'none' = no suffix

  return base;
}

function resolveComputerName(computerNameConfig) {
  const mode = String(computerNameConfig?.mode || 'random');
  if (mode === 'custom' && computerNameConfig?.customName) return String(computerNameConfig.customName).trim();
  if (mode === 'fixed') return 'WIN-PC';
  return randomComputerName();
}

function pickRandomSubset(pool, min, max) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const count = crypto.randomInt(Math.min(min, pool.length), Math.min(max, pool.length) + 1);
  const shuffled = [...pool].sort(() => crypto.randomInt(3) - 1);
  return shuffled.slice(0, count);
}

function resolveSoftwareList(removalConfig) {
  const mode = String(removalConfig?.mode || 'fixed');
  const fixed = Array.isArray(removalConfig?.fixedPackages) ? removalConfig.fixedPackages : [];
  const pool = Array.isArray(removalConfig?.randomPool) ? removalConfig.randomPool : [];
  const neverRemove = new Set(Array.isArray(removalConfig?.neverRemove) ? removalConfig.neverRemove : []);
  const min = removalConfig?.randomCount?.min ?? 5;
  const max = removalConfig?.randomCount?.max ?? 15;

  let result;
  if (mode === 'fixed') {
    result = [...fixed];
  } else if (mode === 'random') {
    result = pickRandomSubset(pool, min, max);
  } else {
    // mixed / fixed_random: fixed + random extras
    const randomPart = pickRandomSubset(pool.filter(p => !fixed.includes(p)), min, max);
    result = [...new Set([...fixed, ...randomPart])];
  }

  // filter out neverRemove
  return result.filter(pkg => !neverRemove.has(pkg));
}

function resolveCapabilityList(removalConfig) {
  const mode = String(removalConfig?.mode || 'fixed');
  const fixed = Array.isArray(removalConfig?.fixedCapabilities) ? removalConfig.fixedCapabilities : [];
  const pool = Array.isArray(removalConfig?.randomPool) ? removalConfig.randomPool : [];

  if (mode === 'fixed') return [...fixed];
  if (mode === 'random') return pickRandomSubset(pool, 3, 10);
  return [...new Set([...fixed, ...pickRandomSubset(pool.filter(c => !fixed.includes(c)), 3, 10)])];
}

/**
 * Resolve inputLocales string from either keyboardLayouts array or legacy inputLocales.
 */
function resolveInputLocales(locale) {
  // new format: keyboardLayouts array of {language, layout}
  if (Array.isArray(locale?.keyboardLayouts) && locale.keyboardLayouts.length > 0) {
    return locale.keyboardLayouts
      .map(kl => `${kl.language}:${kl.layout}`)
      .join(';');
  }
  // legacy format: inputLocales string array
  if (Array.isArray(locale?.inputLocales) && locale.inputLocales.length > 0) {
    return locale.inputLocales.join(';');
  }
  return '0409:00000409';
}

// ---------------------------------------------------------------------------
// Visual effects registry PS1
// ---------------------------------------------------------------------------

const VISUAL_EFFECTS_REGISTRY = [
  { key: 'animateControls', path: 'HKCU\\Control Panel\\Desktop\\WindowMetrics', value: 'MinAnimate', type: 'REG_SZ', on: '1', off: '0' },
  { key: 'animateMinMax', path: 'HKCU\\Control Panel\\Desktop\\WindowMetrics', value: 'MinAnimate', type: 'REG_SZ', on: '1', off: '0' },
  { key: 'animateTaskbar', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'TaskbarAnimations', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'aeropeek', path: 'HKCU\\Software\\Microsoft\\Windows\\DWM', value: 'EnableAeroPeek', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'fontSmoothing', path: 'HKCU\\Control Panel\\Desktop', value: 'FontSmoothing', type: 'REG_SZ', on: '2', off: '0' },
  { key: 'dragFullWindows', path: 'HKCU\\Control Panel\\Desktop', value: 'DragFullWindows', type: 'REG_SZ', on: '1', off: '0' },
  { key: 'listBoxSmoothScrolling', path: 'HKCU\\Control Panel\\Desktop', value: 'SmoothScroll', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'cursorShadow', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'ListviewShadow', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'thumbnailPreviews', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'IconsOnly', type: 'REG_DWORD', on: 0, off: 1 },
  { key: 'translucent', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'ListviewAlphaSelect', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'iconShadow', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'ListviewShadow', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'saveThumbnails', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'DisableThumbnailCache', type: 'REG_DWORD', on: 0, off: 1 },
  { key: 'peekDesktop', path: 'HKCU\\Software\\Microsoft\\Windows\\DWM', value: 'EnableAeroPeek', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'windowShadow', path: 'HKCU\\Software\\Microsoft\\Windows\\DWM', value: 'Composition', type: 'REG_DWORD', on: 1, off: 0 },
  { key: 'fadeMenuItems', path: 'HKCU\\Control Panel\\Desktop', value: 'MenuShowDelay', type: 'REG_SZ', on: '400', off: '0' },
  { key: 'fadeTooltips', path: 'HKCU\\Control Panel\\Desktop', value: 'MenuShowDelay', type: 'REG_SZ', on: '400', off: '0' },
  { key: 'fadeAfterClick', path: 'HKCU\\Control Panel\\Desktop', value: 'MenuShowDelay', type: 'REG_SZ', on: '400', off: '0' },
  { key: 'comboBoxSlide', path: 'HKCU\\Control Panel\\Desktop', value: 'MenuShowDelay', type: 'REG_SZ', on: '400', off: '0' },
];

function buildVisualEffectsRegistryPs1(visualEffectsConfig) {
  const mode = String(visualEffectsConfig?.mode || 'default');
  if (mode === 'default') return '';

  const effects = visualEffectsConfig?.effects || {};
  const lines = [];

  // Set VisualFXSetting to custom (3)
  lines.push('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 3 /f');

  const seen = new Set();
  for (const entry of VISUAL_EFFECTS_REGISTRY) {
    const regKey = `${entry.path}\\${entry.value}`;
    if (seen.has(regKey)) continue;
    seen.add(regKey);

    let enabled;
    if (mode === 'appearance') {
      enabled = true;
    } else if (mode === 'performance') {
      enabled = false;
    } else if (mode === 'custom') {
      enabled = effects[entry.key] !== undefined ? !!effects[entry.key] : false;
    } else {
      // custom_randomize: use per-effect value if set, otherwise random
      enabled = effects[entry.key] !== undefined ? !!effects[entry.key] : crypto.randomInt(2) === 1;
    }

    const val = enabled ? entry.on : entry.off;
    const typeStr = entry.type === 'REG_DWORD' ? 'REG_DWORD' : 'REG_SZ';
    lines.push(`reg add "${entry.path}" /v ${entry.value} /t ${typeStr} /d ${val} /f`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Desktop icons registry PS1
// ---------------------------------------------------------------------------

const DESKTOP_ICON_CLSIDS = {
  thisPC: '{20D04FE0-3AEA-1069-A2D8-08002B30309D}',
  recycleBin: '{645FF040-5081-101B-9F08-00AA002F954E}',
  userFiles: '{59031a47-3f72-44a7-89c5-5595fe6b30ee}',
  controlPanel: '{5399E694-6CE5-4D6C-8FCE-1D8870FDCBA0}',
  network: '{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}',
};

function buildDesktopIconsRegistryPs1(desktopIconsConfig) {
  const mode = String(desktopIconsConfig?.mode || 'default');
  if (mode === 'default') return '';

  const icons = desktopIconsConfig?.icons || {};
  const startFolders = desktopIconsConfig?.startFolders || {};
  const lines = [];

  // Desktop icons: 0 = show, 1 = hide
  for (const [key, clsid] of Object.entries(DESKTOP_ICON_CLSIDS)) {
    let show;
    if (mode === 'custom') {
      show = icons[key] !== undefined ? !!icons[key] : false;
    } else {
      // custom_randomize
      show = icons[key] !== undefined ? !!icons[key] : crypto.randomInt(2) === 1;
    }
    const regValue = show ? 0 : 1;
    lines.push(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\HideDesktopIcons\\NewStartPanel" /v "${clsid}" /t REG_DWORD /d ${regValue} /f`);
  }

  // Start folders (Settings > Personalization > Start)
  const START_FOLDER_KEYS = {
    documents: 'Start_ShowDocuments',
    downloads: 'Start_ShowDownloads',
    music: 'Start_ShowMusic',
    pictures: 'Start_ShowPictures',
    videos: 'Start_ShowVideos',
    personalFolder: 'Start_ShowPersonalFolder',
    settings: 'Start_ShowSettings',
    fileExplorer: 'Start_ShowFileExplorer',
    network: 'Start_ShowNetwork',
  };

  for (const [key, regName] of Object.entries(START_FOLDER_KEYS)) {
    if (startFolders[key] !== undefined) {
      const val = startFolders[key] ? 1 : 0;
      lines.push(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Start" /v "${regName}" /t REG_DWORD /d ${val} /f`);
    }
  }

  // Delete Edge shortcut
  if (desktopIconsConfig?.deleteEdgeShortcut) {
    lines.push('Remove-Item -Path "$env:PUBLIC\\Desktop\\Microsoft Edge.lnk" -Force -ErrorAction SilentlyContinue');
    lines.push('Remove-Item -Path "$env:USERPROFILE\\Desktop\\Microsoft Edge.lnk" -Force -ErrorAction SilentlyContinue');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PS1 script generators
// ---------------------------------------------------------------------------

function buildRemovePackagesPs1(packages) {
  if (!packages.length) return '';
  const lines = packages.map(pkg =>
    `Get-AppxProvisionedPackage -Online | Where-Object { $_.PackageName -like '*${pkg}*' } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue`
  );
  return lines.join('\n');
}

function buildRemoveCapabilitiesPs1(capabilities) {
  if (!capabilities.length) return '';
  const lines = capabilities.map(cap =>
    `Get-WindowsCapability -Online | Where-Object { $_.Name -like '*${cap}*' -and $_.State -eq 'Installed' } | Remove-WindowsCapability -Online -ErrorAction SilentlyContinue`
  );
  return lines.join('\n');
}

function buildWindowsSettingsPs1(settings) {
  const lines = [];

  if (settings.disableDefender) {
    lines.push('Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction SilentlyContinue');
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender" /v DisableAntiSpyware /t REG_DWORD /d 1 /f');
  }
  if (settings.disableWindowsUpdate) {
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f');
  }
  if (settings.disableUac) {
    lines.push('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLUA /t REG_DWORD /d 0 /f');
  }
  if (settings.disableSmartScreen) {
    lines.push('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v SmartScreenEnabled /t REG_SZ /d Off /f');
  }
  if (settings.disableSystemRestore) {
    lines.push('Disable-ComputerRestore -Drive "C:\\" -ErrorAction SilentlyContinue');
  }
  if (settings.enableLongPaths) {
    lines.push('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f');
  }
  if (settings.allowPowerShellScripts) {
    lines.push('Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope LocalMachine -Force');
  }
  if (settings.disableWidgets) {
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh" /v AllowNewsAndInterests /t REG_DWORD /d 0 /f');
  }
  if (settings.disableEdgeStartup) {
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v HideFirstRunExperience /t REG_DWORD /d 1 /f');
  }
  if (settings.preventDeviceEncryption) {
    lines.push('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\BitLocker" /v PreventDeviceEncryption /t REG_DWORD /d 1 /f');
  }
  if (settings.disableStickyKeys) {
    lines.push('reg add "HKCU\\Control Panel\\Accessibility\\StickyKeys" /v Flags /t REG_SZ /d 506 /f');
  }
  if (settings.enableRemoteDesktop) {
    lines.push('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f');
    lines.push('netsh advfirewall firewall set rule group="Remote Desktop" new enable=Yes');
  }

  return lines.join('\n');
}

function buildGeoLocationPs1(geoLocation) {
  if (!geoLocation || !Number.isFinite(geoLocation)) return '';
  return `Set-WinHomeLocation -GeoId ${geoLocation}`;
}

function buildStartPs1(provisionConfig) {
  return `# Bot-Mox VM Bootstrap Script
$ErrorActionPreference = 'SilentlyContinue'

# Find provision.json on any drive
$provisionPath = $null
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
  $candidate = Join-Path $_.Root 'provision.json'
  if (Test-Path $candidate) { $provisionPath = $candidate }
}

if (-not $provisionPath) {
  Write-Host "ERROR: provision.json not found on any drive"
  exit 1
}

$config = Get-Content $provisionPath -Raw | ConvertFrom-Json

# Set IP address
$adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
if ($adapter) {
  Remove-NetIPAddress -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
  Remove-NetRoute -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
  New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $config.ip.address -PrefixLength (
    [int][Math]::Log(([uint32]4294967296 - [uint32]([System.Net.IPAddress]::Parse($config.ip.netmask).Address)), 2)
  ) -DefaultGateway $config.ip.gateway
  Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses $config.ip.dns
}

# Read machine UUID (with Proxmox byte-order flip for first 3 groups)
$rawUuid = (Get-WmiObject Win32_ComputerSystemProduct).UUID
$parts = $rawUuid -split '-'
if ($parts.Count -ge 3) {
  $parts[0] = -join ($parts[0] -split '(..)' | Where-Object { $_ } | ForEach-Object { $_ })[-1..-4]
  $parts[1] = -join ($parts[1] -split '(..)' | Where-Object { $_ } | ForEach-Object { $_ })[-1..-2]
  $parts[2] = -join ($parts[2] -split '(..)' | Where-Object { $_ } | ForEach-Object { $_ })[-1..-2]
}
$machineUuid = ($parts -join '-').ToLower()

# Validate token with server
$body = @{
  token = $config.token
  vm_uuid = $config.vm_uuid
} | ConvertTo-Json

try {
  $response = Invoke-RestMethod -Uri "$($config.api_endpoint)/api/v1/provisioning/validate-token" -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
  if (-not $response.success) {
    Write-Host "Token validation failed"
    exit 1
  }
} catch {
  Write-Host "Failed to validate token: $_"
  exit 1
}

# Report progress: windows_installed
$progressBody = @{
  token = $config.token
  vm_uuid = $config.vm_uuid
  step = 'windows_installed'
  status = 'completed'
} | ConvertTo-Json
Invoke-RestMethod -Uri "$($config.api_endpoint)/api/v1/provisioning/report-progress" -Method POST -Body $progressBody -ContentType 'application/json' -UseBasicParsing -ErrorAction SilentlyContinue

# Download bootstrap (if S3 endpoint is available)
if ($config.s3_endpoint) {
  $progressBody = @{ token = $config.token; vm_uuid = $config.vm_uuid; step = 'downloader_ready'; status = 'running' } | ConvertTo-Json
  Invoke-RestMethod -Uri "$($config.api_endpoint)/api/v1/provisioning/report-progress" -Method POST -Body $progressBody -ContentType 'application/json' -UseBasicParsing -ErrorAction SilentlyContinue

  # The validate-token response should contain presigned URLs
  if ($response.data.bootstrap_url) {
    $downloaderPath = "C:\\WindowsSetup\\downloader.exe"
    New-Item -ItemType Directory -Path "C:\\WindowsSetup" -Force | Out-Null
    Invoke-WebRequest -Uri $response.data.bootstrap_url -OutFile $downloaderPath -UseBasicParsing
    if (Test-Path $downloaderPath) {
      Start-Process -FilePath $downloaderPath -ArgumentList "--config", $provisionPath -Wait
    }
  }
}

Write-Host "Bootstrap complete"
`;
}

// ---------------------------------------------------------------------------
// Main XML builder
// ---------------------------------------------------------------------------

function buildUnattendXml({ profileConfig, provisionConfig }) {
  const config = profileConfig || {};
  const username = resolveUsername(config.user);
  const password = String(config.user?.password || '1204');
  const group = String(config.user?.group || 'Administrators');
  const autoLogonCount = Number(config.user?.autoLogonCount) || 9999999;
  const displayName = config.user?.displayName || username;
  const computerName = resolveComputerName(config.computerName);
  const locale = config.locale || {};
  const uiLanguage = String(locale.uiLanguage || 'en-US');
  const inputLocales = resolveInputLocales(locale);
  const timeZone = String(locale.timeZone || 'Turkey Standard Time');
  const geoLocation = Number(locale.geoLocation || 235);

  const softwareList = resolveSoftwareList(config.softwareRemoval);
  const capabilityList = resolveCapabilityList(config.capabilityRemoval);
  const windowsSettings = config.windowsSettings || {};
  const visualEffects = config.visualEffects || {};
  const desktopIcons = config.desktopIcons || {};
  const customScript = config.customScript || { executable: 'START.exe', delaySeconds: 20 };

  const removePackagesScript = buildRemovePackagesPs1(softwareList);
  const removeCapabilitiesScript = buildRemoveCapabilitiesPs1(capabilityList);
  const settingsScript = buildWindowsSettingsPs1(windowsSettings);
  const geoLocationScript = buildGeoLocationPs1(geoLocation);
  const visualEffectsScript = buildVisualEffectsRegistryPs1(visualEffects);
  const desktopIconsScript = buildDesktopIconsRegistryPs1(desktopIcons);

  // Combined FirstLogonCommand scripts
  const firstLogonScripts = [
    removePackagesScript,
    removeCapabilitiesScript,
    settingsScript,
    geoLocationScript,
    visualEffectsScript,
    desktopIconsScript,
  ].filter(Boolean);

  const provisionJson = JSON.stringify({
    version: 1,
    vm_uuid: provisionConfig.vmUuid || '',
    ip: provisionConfig.ip || {},
    token: provisionConfig.token || '',
    s3_endpoint: provisionConfig.s3Endpoint || '',
    api_endpoint: provisionConfig.apiEndpoint || '',
    bootstrap_url: '/provisioning/validate-token',
  }, null, 2);

  const passwordBase64 = Buffer.from(`${password}Password`).toString('base64');

  const firstLogonCommands = [];
  let commandOrder = 1;

  // Write provision.json
  firstLogonCommands.push(`
        <SynchronousCommand wcm:action="add">
          <Order>${commandOrder++}</Order>
          <CommandLine>cmd /c mkdir C:\\WindowsSetup</CommandLine>
          <Description>Create setup directory</Description>
        </SynchronousCommand>`);

  firstLogonCommands.push(`
        <SynchronousCommand wcm:action="add">
          <Order>${commandOrder++}</Order>
          <CommandLine>powershell -NoProfile -Command "Set-Content -Path 'C:\\WindowsSetup\\provision.json' -Value (Get-Content -Path ((Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root 'provision.json' } | Where-Object { Test-Path $_ } | Select-Object -First 1)))"</CommandLine>
          <Description>Copy provision.json from config ISO</Description>
        </SynchronousCommand>`);

  // Apply Windows settings
  if (firstLogonScripts.length > 0) {
    const combinedScript = firstLogonScripts.join('\n\n');
    const escapedScript = escapeXml(combinedScript).replace(/\n/g, '&#xA;');
    firstLogonCommands.push(`
        <SynchronousCommand wcm:action="add">
          <Order>${commandOrder++}</Order>
          <CommandLine>powershell -NoProfile -ExecutionPolicy Bypass -Command "${escapedScript}"</CommandLine>
          <Description>Apply Windows settings and remove packages</Description>
        </SynchronousCommand>`);
  }

  // Run custom script (START.exe by default) with delay
  const executable = String(customScript.executable || 'START.exe').trim();
  const delaySeconds = Number(customScript.delaySeconds) || 20;
  firstLogonCommands.push(`
        <SynchronousCommand wcm:action="add">
          <Order>${commandOrder++}</Order>
          <CommandLine>cmd /c "timeout /t ${delaySeconds} /nobreak &amp; start "SETUP_LOG" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File C:\\WindowsSetup\\${escapeXml(executable)}"</CommandLine>
          <Description>Run provisioning bootstrap</Description>
        </SynchronousCommand>`);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <SetupUILanguage>
        <UILanguage>${escapeXml(uiLanguage)}</UILanguage>
      </SetupUILanguage>
      <InputLocale>${escapeXml(inputLocales)}</InputLocale>
      <SystemLocale>${escapeXml(uiLanguage)}</SystemLocale>
      <UILanguage>${escapeXml(uiLanguage)}</UILanguage>
      <UserLocale>${escapeXml(uiLanguage)}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <DiskConfiguration>
        <Disk wcm:action="add">
          <DiskID>0</DiskID>
          <WillWipeDisk>true</WillWipeDisk>
          <CreatePartitions>
            <CreatePartition wcm:action="add">
              <Order>1</Order>
              <Type>EFI</Type>
              <Size>512</Size>
            </CreatePartition>
            <CreatePartition wcm:action="add">
              <Order>2</Order>
              <Type>MSR</Type>
              <Size>16</Size>
            </CreatePartition>
            <CreatePartition wcm:action="add">
              <Order>3</Order>
              <Type>Primary</Type>
              <Extend>true</Extend>
            </CreatePartition>
          </CreatePartitions>
          <ModifyPartitions>
            <ModifyPartition wcm:action="add">
              <Order>1</Order>
              <PartitionID>1</PartitionID>
              <Format>FAT32</Format>
              <Label>System</Label>
            </ModifyPartition>
            <ModifyPartition wcm:action="add">
              <Order>2</Order>
              <PartitionID>2</PartitionID>
            </ModifyPartition>
            <ModifyPartition wcm:action="add">
              <Order>3</Order>
              <PartitionID>3</PartitionID>
              <Format>NTFS</Format>
              <Label>Windows</Label>
              <Letter>C</Letter>
            </ModifyPartition>
          </ModifyPartitions>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallTo>
            <DiskID>0</DiskID>
            <PartitionID>3</PartitionID>
          </InstallTo>
        </OSImage>
      </ImageInstall>
      <UserData>
        <AcceptEula>true</AcceptEula>
        <ProductKey>
          <WillShowUI>OnError</WillShowUI>
        </ProductKey>
      </UserData>
    </component>
  </settings>
  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <ComputerName>${escapeXml(computerName)}</ComputerName>
      <TimeZone>${escapeXml(timeZone)}</TimeZone>
    </component>
    <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <InputLocale>${escapeXml(inputLocales)}</InputLocale>
      <SystemLocale>${escapeXml(uiLanguage)}</SystemLocale>
      <UILanguage>${escapeXml(uiLanguage)}</UILanguage>
      <UserLocale>${escapeXml(uiLanguage)}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Deployment" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <RunSynchronous>
        <RunSynchronousCommand wcm:action="add">
          <Order>1</Order>
          <Path>reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE" /v BypassNRO /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
      </RunSynchronous>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <OOBE>
        <HideEULAPage>true</HideEULAPage>
        <HideLocalAccountScreen>true</HideLocalAccountScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>
        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC>
      </OOBE>
      <UserAccounts>
        <LocalAccounts>
          <LocalAccount wcm:action="add">
            <Name>${escapeXml(username)}</Name>
            <DisplayName>${escapeXml(displayName)}</DisplayName>
            <Group>${escapeXml(group)}</Group>
            <Password>
              <Value>${passwordBase64}</Value>
              <PlainText>false</PlainText>
            </Password>
          </LocalAccount>
        </LocalAccounts>
      </UserAccounts>
      <AutoLogon>
        <Enabled>true</Enabled>
        <Username>${escapeXml(username)}</Username>
        <Password>
          <Value>${passwordBase64}</Value>
          <PlainText>false</PlainText>
        </Password>
        <LogonCount>${autoLogonCount}</LogonCount>
      </AutoLogon>
      <FirstLogonCommands>${firstLogonCommands.join('')}
      </FirstLogonCommands>
    </component>
  </settings>
</unattend>`;

  return { xml, provisionJson, computerName, username };
}

module.exports = {
  buildUnattendXml,
  resolveUsername,
  resolveComputerName,
  buildStartPs1,
};
