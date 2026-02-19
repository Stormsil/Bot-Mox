import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

const PROXMOX_UI_PREFIXES = [
  '/proxmox-ui',
  '/pve2',
  '/api2',
  '/novnc',
  '/xtermjs',
  '/pwt',
  '/widgettoolkit',
  '/proxmox-widget-toolkit',
  '/qrcode.min.js',
  '/proxmoxlib.js',
  '/PVE',
];

export interface GatewayRouteMatch {
  service: 'proxmox' | 'tinyfm' | 'syncthing';
  routePrefix: string;
}

interface ProxyRequestOptions {
  routePrefix: string;
  targetBaseUrl: string;
  rootFallbackToTarget: boolean;
  preserveRoutePrefix?: boolean;
}

@Injectable()
export class InfraGatewayService {
  private hasBearerAuthorization(headers: IncomingHttpHeaders): boolean {
    const authorization = String(headers.authorization || '').trim();
    return authorization.toLowerCase().startsWith('bearer ') && authorization.length > 7;
  }

  private hasQueryToken(rawUrl: string | undefined): boolean {
    if (!rawUrl) {
      return false;
    }

    const parsed = new URL(rawUrl, 'http://localhost');
    const token = String(
      parsed.searchParams.get('token') ||
        parsed.searchParams.get('access_token') ||
        parsed.searchParams.get('auth') ||
        '',
    ).trim();
    return token.length > 0;
  }

  hasGatewayAuthorization(headers: IncomingHttpHeaders, rawUrl: string | undefined): boolean {
    return this.hasBearerAuthorization(headers) || this.hasQueryToken(rawUrl);
  }

  inferServiceFromRequestHints(headers: IncomingHttpHeaders): GatewayRouteMatch['service'] | null {
    const referer = String(headers.referer || headers.referrer || '').toLowerCase();
    const origin = String(headers.origin || '').toLowerCase();
    const hint = `${referer} ${origin}`;
    if (hint.includes('/tinyfm-ui')) {
      return 'tinyfm';
    }
    if (hint.includes('/syncthing-ui')) {
      return 'syncthing';
    }
    if (hint.includes('/proxmox-ui')) {
      return 'proxmox';
    }
    return null;
  }

  private normalizeBaseTarget(value: string | undefined, fallback: string): string {
    return String(value || fallback || '')
      .trim()
      .replace(/\/+$/, '');
  }

  getProxmoxTarget(): string {
    return this.normalizeBaseTarget(
      process.env.PROXMOX_URL || process.env.PROXMOX_UI_TARGET,
      'https://127.0.0.1:8006',
    );
  }

  getTinyFmTarget(): string {
    return this.normalizeBaseTarget(
      process.env.TINYFM_URL || process.env.TINYFM_UI_TARGET,
      'http://127.0.0.1:8080',
    );
  }

  getSyncThingTarget(): string {
    return this.normalizeBaseTarget(
      process.env.SYNCTHING_URL || process.env.SYNCTHING_UI_TARGET,
      'https://127.0.0.1:8384',
    );
  }

  resolveGatewayRoute(pathname: string): GatewayRouteMatch | null {
    if (pathname.startsWith('/tinyfm-ui')) {
      return {
        service: 'tinyfm',
        routePrefix: '/tinyfm-ui',
      };
    }

    if (pathname.startsWith('/syncthing-ui')) {
      return {
        service: 'syncthing',
        routePrefix: '/syncthing-ui',
      };
    }

    const proxmoxPrefix = PROXMOX_UI_PREFIXES.find((prefix) => pathname.startsWith(prefix));
    if (proxmoxPrefix) {
      return {
        service: 'proxmox',
        routePrefix: proxmoxPrefix,
      };
    }

    return null;
  }

  private rewriteLocationHeader(
    headers: IncomingHttpHeaders,
    routePrefix: string,
    targetBaseUrl: string,
  ): void {
    const location = headers.location;
    if (!location || typeof location !== 'string') {
      return;
    }

    const safePrefix = routePrefix.endsWith('/') ? routePrefix.slice(0, -1) : routePrefix;

    try {
      const targetBase = new URL(targetBaseUrl);
      const resolved = new URL(location, `${targetBase.protocol}//${targetBase.host}`);
      if (resolved.origin === targetBase.origin) {
        headers.location = `${safePrefix}${resolved.pathname}${resolved.search}${resolved.hash}`;
        return;
      }
    } catch {
      // fallback rewrite below
    }

    if (location.startsWith('/')) {
      headers.location = `${safePrefix}${location}`;
    }
  }

  private stripFrameHeaders(headers: IncomingHttpHeaders): void {
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
  }

  private toTargetPath(
    req: Request,
    targetBaseUrl: string,
    routePrefix: string,
    rootFallbackToTarget: boolean,
    preserveRoutePrefix: boolean,
  ): string {
    const target = new URL(targetBaseUrl);
    const fullUrl = new URL(String(req.originalUrl || req.url || '/'), 'http://localhost');
    let suffix = fullUrl.pathname;

    if (routePrefix === '/proxmox-ui') {
      suffix = suffix.replace('/proxmox-ui', '') || '/';
      if (suffix.startsWith('/PVE/')) {
        suffix = `/pve2/js${suffix}`;
      }
    } else if (!preserveRoutePrefix && suffix.startsWith(routePrefix)) {
      suffix = suffix.slice(routePrefix.length) || '/';
    }

    const normalizedSuffix =
      suffix === '/' || suffix === ''
        ? rootFallbackToTarget
          ? `${target.pathname}${target.search || ''}`
          : target.pathname || '/'
        : `${suffix}${fullUrl.search}`;

    return normalizedSuffix;
  }

  private cloneRequestHeaders(req: Request, target: URL): IncomingHttpHeaders {
    const headers: IncomingHttpHeaders = {
      ...req.headers,
      host: target.host,
    };
    delete headers['content-length'];
    return headers;
  }

  private serializeParsedBody(req: Request): string | null {
    if (req.body === undefined || req.body === null) {
      return null;
    }

    if (typeof req.body === 'string') {
      return req.body;
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      return JSON.stringify(req.body);
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams();
      const entries = Object.entries(req.body as Record<string, unknown>);
      for (const [key, value] of entries) {
        if (value === undefined || value === null) {
          continue;
        }
        params.append(key, String(value));
      }
      return params.toString();
    }

    return null;
  }

  private pipeUpstreamResponse(
    upstreamRes: IncomingMessage,
    res: Response,
    options: ProxyRequestOptions,
  ): void {
    const headers: IncomingHttpHeaders = {
      ...upstreamRes.headers,
    };

    this.stripFrameHeaders(headers);
    this.rewriteLocationHeader(headers, options.routePrefix, options.targetBaseUrl);

    res.status(upstreamRes.statusCode || 502);
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) {
        continue;
      }
      res.setHeader(key, value as string | string[]);
    }

    upstreamRes.pipe(res);
  }

  async proxyHttpRequest(req: Request, res: Response, options: ProxyRequestOptions): Promise<void> {
    const target = new URL(options.targetBaseUrl);
    const targetPath = this.toTargetPath(
      req,
      options.targetBaseUrl,
      options.routePrefix,
      options.rootFallbackToTarget,
      Boolean(options.preserveRoutePrefix),
    );

    const proxyOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: targetPath,
      headers: this.cloneRequestHeaders(req, target),
      rejectUnauthorized: false,
    };

    await new Promise<void>((resolve, reject) => {
      const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
      const upstreamReq = transport(proxyOptions, (upstreamRes) => {
        this.pipeUpstreamResponse(upstreamRes, res, options);
        upstreamRes.on('end', () => resolve());
      });

      upstreamReq.on('error', (error) => reject(error));

      if (req.readableEnded || !req.readable) {
        const serializedBody = this.serializeParsedBody(req);
        if (serializedBody) {
          upstreamReq.write(serializedBody);
        }
        upstreamReq.end();
        return;
      }

      req.pipe(upstreamReq);
    });
  }
}
