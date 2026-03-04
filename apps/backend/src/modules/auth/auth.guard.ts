import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { setRequestTenantId } from './request-context';
import { REQUEST_IDENTITY_KEY, type RequestIdentity } from './request-identity';

type RequestWithIdentity = Request & {
  [REQUEST_IDENTITY_KEY]?: RequestIdentity;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithIdentity>();

    if (this.isPublicRequest(req)) {
      return true;
    }

    const userToken = String(
      (req as Request & { cookies?: Record<string, unknown> }).cookies?.botmox_token || '',
    ).trim();
    const verifiedUser = await this.authService.verifyBearerToken(userToken);
    const authorization = String(req.headers.authorization || '').trim();
    const agentVerifier = (
      this.authService as unknown as {
        verifyAgentBearerToken?: (token: string) => ReturnType<AuthService['verifyBearerToken']>;
      }
    ).verifyAgentBearerToken;
    const verifiedAgent: Awaited<ReturnType<AuthService['verifyBearerToken']>> =
      verifiedUser || typeof agentVerifier !== 'function'
        ? null
        : await agentVerifier.call(this.authService, authorization);
    const verified = verifiedUser || verifiedAgent;
    if (!verified) {
      if (this.authService.isShadow()) {
        const shadow = this.authService.createShadowIdentity();
        req[REQUEST_IDENTITY_KEY] = {
          userId: shadow.uid,
          email: shadow.email,
          roles: shadow.roles,
          tenantId: shadow.tenantId,
          access: shadow.access,
          ...(shadow.tokenId ? { tokenId: shadow.tokenId } : {}),
          raw: shadow.raw,
        };
        setRequestTenantId(shadow.tenantId);
        return true;
      }
      throw new UnauthorizedException({
        code: 'INVALID_OR_MISSING_BEARER_TOKEN',
        message: 'Invalid or missing bearer token',
      });
    }

    const isAgentIdentity = this.isAgentIdentity(verified.roles);
    if (isAgentIdentity && !this.isAgentRouteAllowed(req)) {
      throw new ForbiddenException({
        code: 'AGENT_TOKEN_SCOPE_VIOLATION',
        message: 'Agent token is not allowed for this endpoint',
      });
    }

    req[REQUEST_IDENTITY_KEY] = {
      userId: verified.uid,
      email: verified.email,
      roles: verified.roles,
      tenantId: verified.tenantId,
      access: verified.access,
      ...(verified.tokenId ? { tokenId: verified.tokenId } : {}),
      raw: verified.raw,
    };
    setRequestTenantId(verified.tenantId);

    if (this.isWriteRequest(req) && !this.isAuthRoute(req)) {
      if (!verified.access.writeAccess && !this.isMockBillingRoute(req)) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message: 'Premium access or active trial is required for write operations',
        });
      }
    }

    return true;
  }

  private isPublicRequest(req: Request): boolean {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.url || '');

    if (path.startsWith('/api/v1/health')) {
      return true;
    }

    if (path === '/api/v1/agents/quick-pair') {
      return true;
    }
    if (
      path === '/api/v1/auth/signup' ||
      path === '/api/v1/auth/signin' ||
      path === '/api/v1/auth/admin/signin'
    ) {
      return true;
    }

    if (method === 'OPTIONS') {
      return true;
    }

    return false;
  }

  private isWriteRequest(req: Request): boolean {
    const method = String(req.method || 'GET').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }

  private isAuthRoute(req: Request): boolean {
    const path = String(req.path || req.url || '');
    return path.startsWith('/api/v1/auth/');
  }

  private isMockBillingRoute(req: Request): boolean {
    const path = String(req.path || req.url || '');
    return path === '/api/v1/billing/mock/activate' || path === '/api/v1/billing/trial/start';
  }

  private isAgentIdentity(roles: string[] | undefined): boolean {
    const normalized = Array.isArray(roles)
      ? roles
          .map((role) =>
            String(role || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
      : [];
    return normalized.includes('agent');
  }

  private isAgentRouteAllowed(req: Request): boolean {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.url || '');
    if (method === 'POST' && path === '/api/v1/agents/heartbeat') {
      return true;
    }
    if (method === 'GET' && path === '/api/v1/vm-ops/commands/next') {
      return true;
    }
    if (method === 'PATCH' && /^\/api\/v1\/vm-ops\/commands\/[^/]+$/.test(path)) {
      return true;
    }
    return false;
  }
}
