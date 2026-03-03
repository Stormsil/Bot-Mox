import type { VmPatchChange, VmPatchPlan } from './infra.types';

export interface PatchHardwareValues {
  mac: string;
  ssdSerial: string;
  smbiosArgs: string;
}

const RX_ARGS_PORT = /0\.0\.0\.0:(\d{2})/;
const RX_MAC = /(e1000=)([^\s,]+)/;
const RX_BRIDGE = /bridge=vmbr(\d+)/i;
const RX_SERIAL = /(serial=)([A-Za-z0-9-]+)/;
const RX_SMBIOS11 = /(type=11,value=)([^,']*)/;

export function extractVmNumber(name: string): number {
  const match = (name || '').match(/(\d+)$/);
  if (match) {
    const value = Number.parseInt(match[1] ?? '', 10);
    if (!Number.isNaN(value)) {
      return value;
    }
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
  for (const line of lines) {
    const match = line.match(rx);
    if (match) {
      return match[group] ?? '';
    }
  }
  return '';
}

function extractPort(argsLine: string): string {
  if (!argsLine) {
    return '';
  }
  const match = argsLine.match(RX_ARGS_PORT);
  return match ? (match[1] ?? '') : '';
}

export function patchVmConfig(
  cfg: string,
  vmName: string,
  hardware: PatchHardwareValues,
  vmSeedId?: number,
  random: () => number = Math.random,
): VmPatchPlan {
  const vmNumber = deriveVmNumber(vmName, vmSeedId);
  const vmbr = Math.max(1, vmNumber);

  const subnet = 110 + (vmbr - 1);
  const host = Math.floor(random() * 81) + 10;
  const targetIp = `192.168.${subnet}.${host}`;

  let argsBlock = hardware.smbiosArgs;
  const newMac = hardware.mac;
  const newSerial = hardware.ssdSerial;

  const eol = cfg.includes('\r\n') ? '\r\n' : '\n';
  argsBlock = argsBlock.replace(/\r\n/g, '\n').replace(/\n/g, eol).trimEnd();

  const port = (Math.abs(vmNumber) % 100) + 10;
  const portStr = String(port).padStart(2, '0');
  argsBlock = argsBlock.replace(RX_ARGS_PORT, `0.0.0.0:${portStr}`);

  if (RX_SMBIOS11.test(argsBlock)) {
    argsBlock = argsBlock.replace(RX_SMBIOS11, `$1${targetIp}`);
  } else {
    argsBlock += ` -smbios 'type=11,value=${targetIp}'`;
  }

  const lines = cfg.replace(/\r\n/g, '\n').split('\n');
  const oldArgsLine = lines.find((line) => line.trimStart().startsWith('args:')) || '';
  const oldMac = extractFirst(lines, RX_MAC, 2);
  const oldVmbr = extractFirst(lines, RX_BRIDGE, 1);
  const sata0Lines = lines.filter((line) => line.trimStart().startsWith('sata0:'));
  const oldSerial = extractFirst(sata0Lines, RX_SERIAL, 2);
  const oldPort = extractPort(oldArgsLine);
  const oldSmbiosIp = extractFirst([oldArgsLine], /type=11,value=([0-9.]+)/i, 1);

  const argsLineIndex = lines.findIndex((line) => line.trimStart().startsWith('args:'));
  if (argsLineIndex >= 0) {
    lines.splice(argsLineIndex, 1);
  }

  let balloonIndex = lines.findIndex((line) => line.trimStart().startsWith('balloon:'));
  if (balloonIndex < 0) {
    balloonIndex = 0;
  }
  lines.splice(balloonIndex, 0, argsBlock);

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index] ?? '';
    const normalizedLine = line.trimStart().toLowerCase();
    if (normalizedLine.startsWith('net')) {
      line = line.replace(RX_MAC, `$1${newMac}`);
      line = line.replace(RX_BRIDGE, `bridge=vmbr${vmbr}`);
      lines[index] = line;
    } else if (normalizedLine.startsWith('sata0:')) {
      line = line.replace(RX_SERIAL, `$1${newSerial}`);
      lines[index] = line;
    }
  }

  const changes: VmPatchChange[] = [
    { field: 'MAC (e1000)', oldValue: oldMac, newValue: newMac },
    { field: 'Serial (sata0)', oldValue: oldSerial, newValue: newSerial },
    { field: 'Bridge', oldValue: oldVmbr ? `vmbr${oldVmbr}` : '', newValue: `vmbr${vmbr}` },
    { field: 'VNC port', oldValue: oldPort, newValue: portStr },
    { field: 'IP (SMBIOS)', oldValue: oldSmbiosIp, newValue: targetIp },
  ];

  return {
    patched: lines.join(eol),
    changes,
    generatedIp: targetIp,
    generatedMac: newMac,
    generatedSerial: newSerial,
    vncPort: port,
    argsBlock,
  };
}
