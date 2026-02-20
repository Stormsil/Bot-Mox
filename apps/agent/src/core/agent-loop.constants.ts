export const HEARTBEAT_INTERVAL_MS = 30_000;
export const NEXT_COMMAND_TIMEOUT_MS = 25_000;
export const COMMAND_ERROR_BACKOFF_MS = 1_500;
export const RATE_LIMIT_COOLDOWN_MS = 45_000;
export const WS_CONNECT_TIMEOUT_MS = 8_000;
export const WS_EVENT_TIMEOUT_MS = 8_000;
export const WS_RECONNECT_BASE_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 30_000;
export const WS_RECONNECT_JITTER_RATIO = 0.2;

export type AgentTransportMode = 'longpoll' | 'ws' | 'hybrid';

export function resolveTransportMode(): AgentTransportMode {
  const raw = String(process.env.AGENT_TRANSPORT || process.env.BOTMOX_AGENT_TRANSPORT || '')
    .trim()
    .toLowerCase();
  if (raw === 'ws' || raw === 'hybrid' || raw === 'longpoll') {
    return raw;
  }
  return 'hybrid';
}

export function transportModePrefersWs(mode: AgentTransportMode): boolean {
  return mode === 'ws' || mode === 'hybrid';
}
