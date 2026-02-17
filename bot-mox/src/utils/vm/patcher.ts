// VM Config Patcher — TypeScript port of Patcher.cs
// Patches QEMU VM config with spoofed hardware (SMBIOS, MAC, serial)

import { generateSmbios } from './generateSmbios';
import { generateMac } from './generateMac';
import { generateSsdSerial } from './generateSsdSerial';

export interface PatchChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface PatchResult {
  patched: string;
  changes: PatchChange[];
  generatedIp: string;
  generatedMac: string;
  generatedSerial: string;
  vncPort: number;
  argsBlock: string;
}

const RX_ARGS_PORT = /0\.0\.0\.0:(\d{2})/;
const RX_MAC = /(e1000=)([^\s,]+)/;
const RX_BRIDGE = /bridge=vmbr(\d+)/i;
const RX_SERIAL = /(serial=)([A-Za-z0-9-]+)/;
const RX_SMBIOS11 = /(type=11,value=)([^,']*)/;

/**
 * Extract trailing number from VM name (e.g., WoW8 -> 8)
 */
export function extractVmNumber(name: string): number {
  const match = (name || '').match(/(\d+)$/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function deriveVmNumber(vmName: string, vmSeedId?: number): number {
  const byName = extractVmNumber(vmName);
  if (byName > 0) {
    return byName;
  }

  const seed = Number(vmSeedId);
  if (Number.isFinite(seed) && seed > 0) {
    const normalizedSeed = Math.trunc(seed);
    if (normalizedSeed >= 100) {
      return Math.max(1, normalizedSeed - 100);
    }
    return normalizedSeed;
  }

  return 1;
}

function extractFirst(lines: string[], rx: RegExp, group: number): string {
  for (const l of lines) {
    const m = l.match(rx);
    if (m) return m[group];
  }
  return '';
}

function extractPort(argsLine: string): string {
  if (!argsLine) return '';
  const m = argsLine.match(RX_ARGS_PORT);
  return m ? m[1] : '';
}

/**
 * Patch a QEMU VM config with new hardware identifiers.
 * Direct port of Patcher.cs BuildPatchedAsync.
 */
export function patchConfig(cfg: string, vmName: string, vmSeedId?: number): PatchResult {
  // 1. Resolve VM index from name suffix, fallback to VM ID.
  const vmNumber = deriveVmNumber(vmName, vmSeedId);
  const vmbr = Math.max(1, vmNumber);

  // 2. Calculate IP: subnet = 110 + (vmbr - 1)
  const subnet = 110 + (vmbr - 1);
  const host = Math.floor(Math.random() * 81) + 10; // [10, 90]
  const targetIp = `192.168.${subnet}.${host}`;

  // 3. Generate SMBIOS, MAC, serial (replaces .exe execution)
  const smbiosResult = generateSmbios();
  let argsBlock = smbiosResult.args;
  const newMac = generateMac();
  const newSn = generateSsdSerial();

  // Normalize line endings in argsBlock
  const eol = cfg.includes('\r\n') ? '\r\n' : '\n';
  argsBlock = argsBlock.replace(/\r\n/g, '\n').replace(/\n/g, eol).trimEnd();

  // 4. Patch VNC port: (vmNumber % 100) + 10
  const port = (Math.abs(vmNumber) % 100) + 10;
  const portStr = port.toString().padStart(2, '0');
  argsBlock = argsBlock.replace(RX_ARGS_PORT, `0.0.0.0:${portStr}`);

  // 5. Inject IP into SMBIOS type=11
  if (RX_SMBIOS11.test(argsBlock)) {
    argsBlock = argsBlock.replace(RX_SMBIOS11, `$1${targetIp}`);
  } else {
    argsBlock += ` -smbios 'type=11,value=${targetIp}'`;
  }

  // Parse config lines
  const lines = cfg.replace(/\r\n/g, '\n').split('\n');

  // Extract old values for change tracking
  const oldArgsLine = lines.find(l => l.trimStart().startsWith('args:')) || '';
  const oldMac = extractFirst(lines, RX_MAC, 2);
  const oldVmbr = extractFirst(lines, RX_BRIDGE, 1);
  const sata0Lines = lines.filter(l => l.trimStart().startsWith('sata0:'));
  const oldSn = extractFirst(sata0Lines, RX_SERIAL, 2);
  const oldPort = extractPort(oldArgsLine);
  const oldSmbiosIp = extractFirst([oldArgsLine], /type=11,value=([0-9.]+)/i, 1);

  // Remove old args line
  const iArgs = lines.findIndex(l => l.trimStart().startsWith('args:'));
  if (iArgs >= 0) lines.splice(iArgs, 1);

  // Insert new args before balloon: line
  let iBalloon = lines.findIndex(l => l.trimStart().startsWith('balloon:'));
  if (iBalloon < 0) iBalloon = 0;
  lines.splice(iBalloon, 0, argsBlock);

  // Patch net and sata0 lines
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    const lt = l.trimStart();

    if (lt.toLowerCase().startsWith('net')) {
      l = l.replace(RX_MAC, `$1${newMac}`);
      l = l.replace(RX_BRIDGE, `bridge=vmbr${vmbr}`);
      lines[i] = l;
    } else if (lt.toLowerCase().startsWith('sata0:')) {
      l = l.replace(RX_SERIAL, `$1${newSn}`);
      lines[i] = l;
    }
  }

  const result = lines.join(eol);

  const changes: PatchChange[] = [
    { field: 'MAC (e1000)', oldValue: oldMac, newValue: newMac },
    { field: 'Serial (sata0)', oldValue: oldSn, newValue: newSn },
    { field: 'Bridge', oldValue: oldVmbr ? `vmbr${oldVmbr}` : '', newValue: `vmbr${vmbr}` },
    { field: 'VNC port', oldValue: oldPort, newValue: portStr },
    { field: 'IP (SMBIOS)', oldValue: oldSmbiosIp, newValue: targetIp },
  ];

  return {
    patched: result,
    changes,
    generatedIp: targetIp,
    generatedMac: newMac,
    generatedSerial: newSn,
    vncPort: port,
    argsBlock,
  };
}
