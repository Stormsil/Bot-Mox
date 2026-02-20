import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
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

    const authorization = String(req.headers.authorization || '').trim();
    const verified = await this.authService.verifyBearerToken(authorization);
    if (!verified) {
      if (this.authService.isShadow()) {
        const shadow = this.authService.createShadowIdentity();
        req[REQUEST_IDENTITY_KEY] = {
          userId: shadow.uid,
          email: shadow.email,
          roles: shadow.roles,
          tenantId: shadow.tenantId,
          ...(shadow.tokenId ? { tokenId: shadow.tokenId } : {}),
          raw: shadow.raw,
        };
        return true;
      }
      throw new UnauthorizedException({
        code: 'INVALID_OR_MISSING_BEARER_TOKEN',
        message: 'Invalid or missing bearer token',
      });
    }

    req[REQUEST_IDENTITY_KEY] = {
      userId: verified.uid,
      email: verified.email,
      roles: verified.roles,
      tenantId: verified.tenantId,
      ...(verified.tokenId ? { tokenId: verified.tokenId } : {}),
      raw: verified.raw,
    };
    return true;
  }

  private isPublicRequest(req: Request): boolean {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.url || '');

    if (path.startsWith('/api/v1/health')) {
      return true;
    }

    if (method === 'OPTIONS') {
      return true;
    }

    return false;
  }
}
