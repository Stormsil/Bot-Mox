const PROXMOX_TARGET_STORAGE_KEY = 'botmox.proxmox.target.id';
const PROXMOX_TARGET_NODE_STORAGE_KEY = 'botmox.proxmox.target.node';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getSelectedProxmoxTargetId(): string | null {
  if (!canUseLocalStorage()) return null;
  const value = String(window.localStorage.getItem(PROXMOX_TARGET_STORAGE_KEY) || '').trim();
  return value || null;
}

export function getSelectedProxmoxTargetNode(): string | null {
  if (!canUseLocalStorage()) return null;
  const value = String(window.localStorage.getItem(PROXMOX_TARGET_NODE_STORAGE_KEY) || '').trim();
  return value || null;
}

export function setSelectedProxmoxTargetId(targetId: string | null): void {
  if (!canUseLocalStorage()) return;
  const normalized = String(targetId || '').trim();
  if (!normalized) {
    window.localStorage.removeItem(PROXMOX_TARGET_STORAGE_KEY);
    window.localStorage.removeItem(PROXMOX_TARGET_NODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PROXMOX_TARGET_STORAGE_KEY, normalized);
}

export function setSelectedProxmoxTargetNode(node: string | null): void {
  if (!canUseLocalStorage()) return;
  const normalized = String(node || '').trim();
  if (!normalized) {
    window.localStorage.removeItem(PROXMOX_TARGET_NODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PROXMOX_TARGET_NODE_STORAGE_KEY, normalized);
}
