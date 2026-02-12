import { buildProxyUiUrl } from '../../config/env';

export type VMServiceKind = 'proxmox' | 'tinyfm' | 'syncthing';

function getProxyServerBaseUrl(): string {
  return buildProxyUiUrl('');
}

export function getServiceFrameUrl(kind: VMServiceKind): string {
  if (kind === 'proxmox') {
    const base = getProxyServerBaseUrl();
    return `${base}/proxmox-ui/`;
  }
  if (kind === 'tinyfm') {
    return buildProxyUiUrl('/tinyfm-ui/');
  }
  return buildProxyUiUrl('/syncthing-ui/');
}

export function getServiceFrameTitle(kind: VMServiceKind): string {
  if (kind === 'proxmox') return 'Proxmox';
  if (kind === 'tinyfm') return 'TinyFileManager';
  return 'SyncThing';
}

export function normalizeCores(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.max(1, Math.trunc(parsed));
}

export function normalizeMemory(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  const mb = parsed <= 64 ? parsed * 1024 : parsed;
  if (!Number.isFinite(mb) || mb < 256) {
    return fallback;
  }

  return Math.max(256, Math.trunc(mb));
}
