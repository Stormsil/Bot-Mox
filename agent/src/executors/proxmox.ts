import * as https from 'https';
import * as http from 'http';
import { ProxmoxConfig } from '../core/config-store';
import { Logger } from '../core/logger';

// ---------------------------------------------------------------------------
// Proxmox REST API client — ported from connectors.js
// ---------------------------------------------------------------------------

interface ProxmoxSession {
  ticket: string;
  csrf: string;
  expiresAt: number;
  baseUrl: string;
}

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

let session: ProxmoxSession | null = null;

// ---------------------------------------------------------------------------
// Low-level HTTP helper
// ---------------------------------------------------------------------------

function httpRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: https.RequestOptions = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers,
      timeout: 30_000,
      ...(isHttps ? { agent: insecureAgent } : {}),
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode ?? 0, data });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      const buf = Buffer.from(body, 'utf-8');
      req.setHeader('Content-Length', buf.byteLength);
      req.write(buf);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function login(config: ProxmoxConfig, logger: Logger): Promise<ProxmoxSession> {
  const now = Date.now();
  if (session && now < session.expiresAt) return session;

  const baseUrl = config.url.replace(/\/+$/, '');
  const username = config.username.includes('@')
    ? config.username
    : `${config.username}@pam`;

  logger.info(`Proxmox login to ${baseUrl} as ${username}`);

  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(config.password)}`;

  const response = await httpRequest(
    'POST',
    `${baseUrl}/api2/json/access/ticket`,
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  );

  const loginData = (response.data as { data?: { ticket?: string; CSRFPreventionToken?: string } })?.data;
  if (!loginData?.ticket) {
    const detail = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new Error(`Proxmox login failed (HTTP ${response.status}): ${detail}`);
  }

  session = {
    ticket: loginData.ticket,
    csrf: loginData.CSRFPreventionToken || '',
    expiresAt: now + 90 * 60 * 1000,
    baseUrl,
  };

  logger.info('Proxmox session authenticated');
  return session;
}

// ---------------------------------------------------------------------------
// Authenticated request
// ---------------------------------------------------------------------------

async function proxmoxRequest(
  config: ProxmoxConfig,
  logger: Logger,
  method: string,
  apiPath: string,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const s = await login(config, logger);
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

  const response = await httpRequest(method, url, headers, body);
  return (response.data as { data?: unknown })?.data ?? response.data;
}

// ---------------------------------------------------------------------------
// Public executor
// ---------------------------------------------------------------------------

export async function executeProxmox(
  commandType: string,
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<unknown> {
  const action = commandType.replace('proxmox.', '');
  const node = String(payload.node || config.node);
  const vmid = payload.vmid ? String(payload.vmid) : undefined;

  switch (action) {
    // VM power actions
    case 'start':
    case 'stop':
    case 'shutdown':
    case 'reset':
    case 'suspend':
    case 'resume': {
      if (!vmid) throw new Error(`vmid required for proxmox.${action}`);
      return proxmoxRequest(config, logger, 'POST',
        `/api2/json/nodes/${node}/qemu/${vmid}/status/${action}`);
    }

    // Clone
    case 'clone': {
      if (!vmid) throw new Error('vmid required for proxmox.clone');
      const cloneData: Record<string, unknown> = {};
      if (payload.newid) cloneData.newid = payload.newid;
      if (payload.name) cloneData.name = payload.name;
      if (payload.storage) cloneData.storage = payload.storage;
      if (payload.format) cloneData.format = payload.format;
      if (payload.full !== undefined) cloneData.full = payload.full ? 1 : 0;
      return proxmoxRequest(config, logger, 'POST',
        `/api2/json/nodes/${node}/qemu/${vmid}/clone`, cloneData);
    }

    // Delete
    case 'delete': {
      if (!vmid) throw new Error('vmid required for proxmox.delete');
      return proxmoxRequest(config, logger, 'DELETE',
        `/api2/json/nodes/${node}/qemu/${vmid}`);
    }

    // List VMs
    case 'list':
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/qemu`);

    // Get VM config
    case 'config.get': {
      if (!vmid) throw new Error('vmid required for proxmox.config.get');
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`);
    }

    // Update VM config
    case 'config.update': {
      if (!vmid) throw new Error('vmid required for proxmox.config.update');
      const cfgData = (payload.config as Record<string, unknown>) ?? {};
      return proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`, cfgData);
    }

    // Proxmox version/status
    case 'status':
      return proxmoxRequest(config, logger, 'GET', '/api2/json/version');

    default:
      throw new Error(`Unknown proxmox action: ${action}`);
  }
}
