import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentApi', {
  pair: (data: {
    serverUrl: string;
    apiToken: string;
    pairingCode: string;
    agentName: string;
    proxmoxUrl: string;
    proxmoxUsername: string;
    proxmoxPassword: string;
    proxmoxNode: string;
  }) => ipcRenderer.invoke('agent:pair', data),

  getConfig: () => ipcRenderer.invoke('agent:get-config'),
});
