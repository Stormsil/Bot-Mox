export type BotMoxRuntimeConfig = {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  otelEnabled?: string;
  otelServiceName?: string;
  otelExporterOtlpEndpoint?: string;
};

declare global {
  interface Window {
    __BOTMOX_CONFIG__?: BotMoxRuntimeConfig;
  }
}

export function getRuntimeConfig(): BotMoxRuntimeConfig {
  if (typeof window === 'undefined') return {};

  const value = window.__BOTMOX_CONFIG__;
  if (!value || typeof value !== 'object') return {};

  return value;
}

export function readRuntimeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
