import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { type GatewayRouteMatch, InfraGatewayService } from './infra-gateway.service';

@Injectable()
export class InfraGatewayMiddleware implements NestMiddleware {
  constructor(private readonly gatewayService: InfraGatewayService) {}

  private ensureAuthorization(req: Request, res: Response): boolean {
    const isAuthorized = this.gatewayService.hasGatewayAuthorization(
      req.headers,
      req.originalUrl || req.url,
    );
    if (isAuthorized) {
      return true;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Auth token is required',
      },
    });
    return false;
  }

  private resolveTarget(route: GatewayRouteMatch): {
    targetBaseUrl: string;
    rootFallbackToTarget: boolean;
  } {
    if (route.service === 'proxmox') {
      return {
        targetBaseUrl: this.gatewayService.getProxmoxTarget(),
        rootFallbackToTarget: false,
      };
    }

    if (route.service === 'tinyfm') {
      return {
        targetBaseUrl: this.gatewayService.getTinyFmTarget(),
        rootFallbackToTarget: true,
      };
    }

    return {
      targetBaseUrl: this.gatewayService.getSyncThingTarget(),
      rootFallbackToTarget: true,
    };
  }

  private renderProxyError(
    res: Response,
    service: GatewayRouteMatch['service'],
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    const titleByService = {
      proxmox: 'Proxmox Unavailable',
      tinyfm: 'TinyFM Unavailable',
      syncthing: 'SyncThing Unavailable',
    } as const;
    const hintByService = {
      proxmox: 'Check that the Proxmox server is running and reachable.',
      tinyfm: 'Check TinyFM URL and credentials in VM settings.',
      syncthing: 'Check SyncThing URL and credentials in VM settings.',
    } as const;

    const html =
      '<html><body style="font-family:sans-serif;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5">' +
      `<div style="text-align:center"><h2>${titleByService[service]}</h2>` +
      `<p>${message}</p>` +
      `<p style="color:#999">${hintByService[service]}</p></div></body></html>`;

    res.status(502).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const pathname = new URL(String(req.originalUrl || req.url || '/'), 'http://localhost')
      .pathname;
    const route = this.gatewayService.resolveGatewayRoute(pathname);
    if (!route) {
      next();
      return;
    }

    if (!this.ensureAuthorization(req, res)) {
      return;
    }

    const target = this.resolveTarget(route);
    try {
      await this.gatewayService.proxyHttpRequest(req, res, {
        routePrefix: route.routePrefix,
        targetBaseUrl: target.targetBaseUrl,
        rootFallbackToTarget: target.rootFallbackToTarget,
        preserveRoutePrefix: route.service === 'proxmox' && route.routePrefix !== '/proxmox-ui',
      });
    } catch (error) {
      this.renderProxyError(res, route.service, error);
    }
  }
}
