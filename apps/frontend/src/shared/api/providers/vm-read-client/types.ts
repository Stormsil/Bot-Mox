export interface ProxmoxTargetInfo {
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  isActive?: boolean;
  sshConfigured?: boolean;
}

export interface StartAndSendKeyOptions {
  node?: string;
  key?: string;
  repeatCount?: number;
  intervalMs?: number;
  startupDelayMs?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface StartAndSendKeyResultItem {
  vmid: number;
  success: boolean;
  error?: string;
}

export interface StartAndSendKeyBatchResult {
  total: number;
  ok: number;
  failed: number;
  results: StartAndSendKeyResultItem[];
}

export interface SendKeySpamResult {
  attempts: number;
  sent: number;
  lastError: string | null;
}
