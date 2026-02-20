import * as http from 'node:http';
import * as https from 'node:https';
import * as os from 'node:os';
import type { Logger } from '../../core/logger';

export function normalizeUrl(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

export function buildDefaultAgentName(): string {
  const hostname = String(os.hostname() || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  const base = hostname || 'agent';
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

export function buildMachineName(): string {
  const hostname = String(os.hostname() || '').trim();
  return hostname || buildDefaultAgentName();
}

export function probeBotMoxHealth(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const normalized = normalizeUrl(baseUrl);
    if (!normalized) {
      resolve(false);
      return;
    }

    let url: URL;
    try {
      url = new URL(`${normalized}/api/v1/health`);
    } catch {
      resolve(false);
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;

    const req = lib.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port,
        path: url.pathname + url.search,
        timeout: 1_800,
      },
      (res) => {
        // Drain body to avoid socket leaks.
        res.on('data', () => {});
        res.on('end', () => {
          resolve(Number(res.statusCode) === 200);
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function resolveServerUrl(candidates: string[], logger: Logger): Promise<string> {
  const attempted: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (!normalized) continue;
    if (attempted.includes(normalized)) continue;
    attempted.push(normalized);

    logger.info(`[pairing] probing serverUrl=${normalized}`);
    // eslint-disable-next-line no-await-in-loop
    const ok = await probeBotMoxHealth(normalized);
    if (ok) {
      logger.info(`[pairing] serverUrl OK: ${normalized}`);
      return normalized;
    }
  }

  throw new Error(
    `Cannot reach Bot-Mox server. Tried: ${attempted.join(', ') || '(no candidates)'}.\n` +
      `Start the stack and retry (prod-sim: http://localhost, dev: http://localhost:3002).`,
  );
}
