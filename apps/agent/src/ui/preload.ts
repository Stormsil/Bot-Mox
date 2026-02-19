import { contextBridge, ipcRenderer } from 'electron';

interface PairingUiConfig {
  serverUrl: string;
  activeTargetId?: string | null;
  proxmoxTargets: Array<{
    id: string;
    label: string;
    url: string;
    username: string;
    node: string;
    hasPassword: boolean;
    password?: string;
  }>;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword: string;
  proxmoxNode: string;
  hasProxmoxPassword: boolean;
}

contextBridge.exposeInMainWorld('agentApi', {
  quickPair: (data: {
    serverUrl: string;
    login: string;
    password: string;
    targetId?: string;
    proxmoxUrl: string;
    proxmoxUsername: string;
    proxmoxPassword: string;
    proxmoxNode: string;
  }) => ipcRenderer.invoke('agent:quick-pair', data),

  getConfig: (): Promise<PairingUiConfig> => ipcRenderer.invoke('agent:get-config'),
  testProxmox: (data: {
    targetId?: string;
    proxmoxUrl: string;
    proxmoxUsername: string;
    proxmoxPassword: string;
    proxmoxNode: string;
  }) => ipcRenderer.invoke('agent:test-proxmox', data),

  saveProxmoxTarget: (data: {
    targetId?: string;
    proxmoxUrl: string;
    proxmoxUsername: string;
    proxmoxPassword: string;
    proxmoxNode: string;
  }) => ipcRenderer.invoke('agent:save-proxmox-target', data),
});
