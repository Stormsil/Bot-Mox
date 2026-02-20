import type { ProxmoxConfig } from '../../core/config-store';
import type { Logger } from '../../core/logger';
import { httpRequest } from './http';

interface ProxmoxSession {
  ticket: string;
  csrf: string;
  expiresAt: number;
  baseUrl: string;
  authKey: string;
}

let session: ProxmoxSession | null = null;

function buildAuthKey(config: ProxmoxConfig): string {
  const baseUrl = String(config.url || '').replace(/\/+$/, '');
  const username = config.username.includes('@') ? config.username : `${config.username}@pam`;
  const password = String(config.password || '');
  return `${baseUrl}|${username}|${password}`;
}

export async function login(
  config: ProxmoxConfig,
  logger: Logger,
  options?: { forceFresh?: boolean },
): Promise<ProxmoxSession> {
  const now = Date.now();
  const authKey = buildAuthKey(config);
  if (!options?.forceFresh && session && session.authKey === authKey && now < session.expiresAt) {
    return session;
  }

  const baseUrl = config.url.replace(/\/+$/, '');
  const username = config.username.includes('@') ? config.username : `${config.username}@pam`;

  logger.info(`Proxmox login to ${baseUrl} as ${username}`);

  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(config.password)}`;

  const response = await httpRequest(
    'POST',
    `${baseUrl}/api2/json/access/ticket`,
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  );

  const loginData = (response.data as { data?: { ticket?: string; CSRFPreventionToken?: string } })
    ?.data;
  if (!loginData?.ticket) {
    const detail =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Proxmox authentication failed (HTTP ${response.status}). Possible wrong username/password.`,
      );
    }
    throw new Error(`Proxmox login failed (HTTP ${response.status}): ${detail}`);
  }

  session = {
    ticket: loginData.ticket,
    csrf: loginData.CSRFPreventionToken || '',
    expiresAt: now + 90 * 60 * 1000,
    baseUrl,
    authKey,
  };

  logger.info('Proxmox session authenticated');
  return session;
}

export async function proxmoxRequest(
  config: ProxmoxConfig,
  logger: Logger,
  method: string,
  apiPath: string,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const authKey = buildAuthKey(config);
  const makeRequest = async (forceFreshLogin: boolean) => {
    const s = await login(config, logger, { forceFresh: forceFreshLogin });
    const url = `${s.baseUrl}${apiPath}`;
    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${s.ticket}`,
      CSRFPreventionToken: s.csrf,
    };

    let body: string | undefined;
    if (data && (method === 'POST' || method === 'PUT')) {
      body = Object.entries(data)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return httpRequest(method, url, headers, body);
  };

  let response = await makeRequest(false);

  if ((response.status === 401 || response.status === 403) && session?.authKey === authKey) {
    session = null;
    response = await makeRequest(true);
  }

  if (response.status >= 400) {
    const detail =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new Error(`Proxmox API ${method} ${apiPath} failed (HTTP ${response.status}): ${detail}`);
  }

  return (response.data as { data?: unknown })?.data ?? response.data;
}
