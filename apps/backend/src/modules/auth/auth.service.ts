import { createSecretKey } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyOptions, jwtVerify } from 'jose';

export interface VerifiedIdentity {
  uid: string;
  email: string;
  roles: string[];
  tenantId: string;
  tokenId?: string;
  raw: JWTPayload;
}

interface TenantResolutionResult {
  tenantId: string | null;
  hasExplicitTenant: boolean;
}

@Injectable()
export class AuthService {
  private readonly authMode = String(process.env.AUTH_MODE || 'enforced')
    .trim()
    .toLowerCase();

  private readonly supabaseIssuer = String(process.env.SUPABASE_JWT_ISSUER || 'supabase').trim();
  private readonly supabaseAudience = String(process.env.SUPABASE_JWT_AUDIENCE || 'authenticated')
    .trim()
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  private readonly supabaseJwtSecret = String(
    process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || '',
  ).trim();

  private readonly supabaseJwksUrl = String(process.env.SUPABASE_JWKS_URL || '').trim();

  private readonly jwks = this.supabaseJwksUrl
    ? createRemoteJWKSet(new URL(this.supabaseJwksUrl))
    : null;
  private readonly shadowTenantId = String(process.env.BOTMOX_SHADOW_TENANT_ID || 'shadow-tenant')
    .trim()
    .toLowerCase();

  isEnforced(): boolean {
    return this.authMode === 'enforced';
  }

  isShadow(): boolean {
    return !this.isEnforced();
  }

  async verifyBearerToken(token: string | null | undefined): Promise<VerifiedIdentity | null> {
    const normalized = String(token || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!normalized) {
      return null;
    }

    const payload = await this.verifyJwtPayload(normalized);
    if (!payload) {
      return null;
    }

    const tenantResolution = this.resolveTenantId(payload);
    if (!tenantResolution.hasExplicitTenant || !tenantResolution.tenantId) {
      return null;
    }
    const roles = this.resolveRoles(payload);

    return {
      uid: String(payload.sub || payload.user_id || '').trim() || 'unknown-user',
      email: String(payload.email || '').trim() || 'unknown@local',
      roles: roles.length > 0 ? roles : ['user'],
      tenantId: tenantResolution.tenantId,
      ...(String(payload.jti || '').trim() ? { tokenId: String(payload.jti).trim() } : {}),
      raw: payload,
    };
  }

  createShadowIdentity(): VerifiedIdentity {
    return {
      uid: 'shadow-user',
      email: 'shadow-user@local',
      roles: ['user'],
      tenantId: this.shadowTenantId || 'shadow-tenant',
      raw: {},
    };
  }

  private resolveTenantId(payload: JWTPayload): TenantResolutionResult {
    const appMetadata =
      payload.app_metadata && typeof payload.app_metadata === 'object'
        ? (payload.app_metadata as Record<string, unknown>)
        : {};
    const userMetadata =
      payload.user_metadata && typeof payload.user_metadata === 'object'
        ? (payload.user_metadata as Record<string, unknown>)
        : {};

    const tenantIdCandidates = [
      payload.tenant_id,
      appMetadata.tenant_id,
      userMetadata.tenant_id,
      payload['https://botmox.dev/tenant_id'],
    ];

    for (const candidate of tenantIdCandidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) {
        return { tenantId: normalized, hasExplicitTenant: true };
      }
    }
    return { tenantId: null, hasExplicitTenant: false };
  }

  private resolveRoles(payload: JWTPayload): string[] {
    const role = String(payload.role || '').trim();
    const appMetadata =
      payload.app_metadata && typeof payload.app_metadata === 'object'
        ? (payload.app_metadata as Record<string, unknown>)
        : {};
    const appRoles = Array.isArray(appMetadata.roles)
      ? appMetadata.roles.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    const result = new Set<string>();
    if (role) {
      result.add(role);
    }
    for (const appRole of appRoles) {
      result.add(appRole);
    }

    return Array.from(result);
  }

  private async verifyJwtPayload(token: string): Promise<JWTPayload | null> {
    const verifyOptions: JWTVerifyOptions = {};
    if (this.supabaseIssuer) {
      verifyOptions.issuer = this.supabaseIssuer;
    }
    if (this.supabaseAudience.length > 0) {
      verifyOptions.audience = this.supabaseAudience;
    }

    if (this.jwks) {
      try {
        const { payload } = await jwtVerify(token, this.jwks, verifyOptions);
        return payload;
      } catch {
        // continue to secret-based validation fallback
      }
    }

    if (!this.supabaseJwtSecret) {
      return null;
    }

    try {
      const key = createSecretKey(Buffer.from(this.supabaseJwtSecret));
      const { payload } = await jwtVerify(token, key, verifyOptions);
      return payload;
    } catch {
      return null;
    }
  }
}
