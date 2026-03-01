import { createSecretKey, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyOptions,
  jwtVerify,
  SignJWT,
} from 'jose';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

export interface AccessProfile {
  tenantType: 'user';
  accessTier: 'free' | 'trial' | 'premium' | 'admin';
  premiumActive: boolean;
  writeAccess: boolean;
  lifetimePremium: boolean;
  trialUsed?: boolean;
  trialEndsAt: string | null;
  premiumUntil: string | null;
}

export interface VerifiedIdentity {
  uid: string;
  email: string;
  roles: string[];
  tenantId: string;
  access: AccessProfile;
  tokenId?: string;
  raw: JWTPayload;
}

interface CreateUserInput {
  email: string;
  password: string;
  tenantId?: string;
  roles?: string[];
}

interface CreatedUserResult {
  id: string;
  email: string;
  tenantId: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  tenantId: string | null;
  roles: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  disabled: boolean;
}

interface TenantResolutionResult {
  tenantId: string | null;
  hasExplicitTenant: boolean;
}

interface RateLimitState {
  count: number;
  resetAtMs: number;
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
  private readonly supabaseApiUrl = String(
    process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || '',
  ).trim();
  private readonly supabaseApiKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  private readonly supabaseServiceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  private readonly adminEmails = new Set(
    String(process.env.SUPABASE_ADMIN_EMAILS || '')
      .split(',')
      .map((value) =>
        String(value || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  private readonly adminUserIds = new Set(
    String(process.env.SUPABASE_ADMIN_USER_IDS || '')
      .split(',')
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );

  private readonly jwks = this.supabaseJwksUrl
    ? createRemoteJWKSet(new URL(this.supabaseJwksUrl))
    : null;
  private readonly shadowTenantId = String(process.env.BOTMOX_SHADOW_TENANT_ID || 'shadow-tenant')
    .trim()
    .toLowerCase();
  private readonly trialDurationHours = Number(
    String(process.env.TRIAL_DURATION_HOURS || '24').trim() || '24',
  );
  private readonly agentJwtSecret = String(
    process.env.AGENT_AUTH_SECRET ||
      process.env.SUPABASE_JWT_SECRET ||
      process.env.JWT_SECRET ||
      '',
  ).trim();
  private readonly agentJwtIssuer = String(process.env.AGENT_AUTH_ISSUER || 'botmox-agent').trim();
  private readonly agentJwtAudience = String(process.env.AGENT_AUTH_AUDIENCE || 'botmox-agent')
    .trim()
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  private readonly agentTokenTtlSeconds = Number(
    String(
      process.env.AGENT_AUTH_TOKEN_TTL_SECONDS || process.env.AGENT_TOKEN_TTL_SECONDS || '900',
    ).trim() || '900',
  );
  private readonly signInRateLimitMax = Number(
    String(process.env.AUTH_SIGNIN_RATE_LIMIT_MAX || '30').trim() || '30',
  );
  private readonly signInRateLimitWindowSeconds = Number(
    String(process.env.AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS || '60').trim() || '60',
  );
  private readonly signUpRateLimitMax = Number(
    String(process.env.AUTH_SIGNUP_RATE_LIMIT_MAX || '10').trim() || '10',
  );
  private readonly signUpRateLimitWindowSeconds = Number(
    String(process.env.AUTH_SIGNUP_RATE_LIMIT_WINDOW_SECONDS || '3600').trim() || '3600',
  );
  private readonly adminRateLimitMax = Number(
    String(process.env.AUTH_ADMIN_RATE_LIMIT_MAX || '120').trim() || '120',
  );
  private readonly adminRateLimitWindowSeconds = Number(
    String(process.env.AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS || '60').trim() || '60',
  );
  private readonly publicAuthRateLimitState = new Map<string, RateLimitState>();
  private readonly adminRateLimitState = new Map<string, RateLimitState>();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    const nodeEnv = String(process.env.NODE_ENV || 'development')
      .trim()
      .toLowerCase();
    if (nodeEnv === 'production' && this.authMode !== 'enforced') {
      throw new Error('AUTH_MODE must be "enforced" in production');
    }
    if (nodeEnv === 'production') {
      const trialHours = Number.isFinite(this.trialDurationHours)
        ? Math.trunc(this.trialDurationHours)
        : NaN;
      if (trialHours !== 24) {
        throw new Error('TRIAL_DURATION_HOURS must be exactly 24 in production');
      }
    }
  }

  isEnforced(): boolean {
    return this.authMode === 'enforced';
  }

  isShadow(): boolean {
    return !this.isEnforced();
  }

  enforcePublicAuthRateLimit(input: {
    scope: 'signin' | 'signup';
    clientIp: string;
    principal?: string;
  }): void {
    const scope = input.scope;
    const clientIp =
      String(input.clientIp || '')
        .trim()
        .toLowerCase() || 'unknown';
    const principal = String(input.principal || '')
      .trim()
      .toLowerCase();

    const nowMs = Date.now();
    const windowSeconds =
      scope === 'signin'
        ? this.normalizeRateLimitWindow(this.signInRateLimitWindowSeconds, 60)
        : this.normalizeRateLimitWindow(this.signUpRateLimitWindowSeconds, 3600);
    const max =
      scope === 'signin'
        ? this.normalizeRateLimitMax(this.signInRateLimitMax, 30)
        : this.normalizeRateLimitMax(this.signUpRateLimitMax, 10);

    this.consumeRateLimitBucket(
      this.publicAuthRateLimitState,
      `${scope}:ip:${clientIp}`,
      max,
      windowSeconds,
      nowMs,
    );
    if (principal) {
      this.consumeRateLimitBucket(
        this.publicAuthRateLimitState,
        `${scope}:principal:${principal}`,
        max,
        windowSeconds,
        nowMs,
      );
    }
  }

  enforceAdminRateLimit(input: {
    action: string;
    clientIp: string;
    actorUserId?: string;
    principal?: string;
  }): void {
    const action =
      String(input.action || 'admin')
        .trim()
        .toLowerCase() || 'admin';
    const clientIp =
      String(input.clientIp || '')
        .trim()
        .toLowerCase() || 'unknown';
    const actorUserId = String(input.actorUserId || '')
      .trim()
      .toLowerCase();
    const principal = String(input.principal || '')
      .trim()
      .toLowerCase();

    const nowMs = Date.now();
    const windowSeconds = this.normalizeRateLimitWindow(this.adminRateLimitWindowSeconds, 60);
    const max = this.normalizeRateLimitMax(this.adminRateLimitMax, 120);

    this.consumeRateLimitBucket(
      this.adminRateLimitState,
      `admin:${action}:ip:${clientIp}`,
      max,
      windowSeconds,
      nowMs,
    );
    if (actorUserId) {
      this.consumeRateLimitBucket(
        this.adminRateLimitState,
        `admin:${action}:actor:${actorUserId}`,
        max,
        windowSeconds,
        nowMs,
      );
    }
    if (principal) {
      this.consumeRateLimitBucket(
        this.adminRateLimitState,
        `admin:${action}:principal:${principal}`,
        max,
        windowSeconds,
        nowMs,
      );
    }
  }

  private normalizeRateLimitWindow(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.min(86_400, Math.trunc(value || fallback)));
  }

  private normalizeRateLimitMax(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.min(10_000, Math.trunc(value || fallback)));
  }

  private consumeRateLimitBucket(
    targetMap: Map<string, RateLimitState>,
    key: string,
    max: number,
    windowSeconds: number,
    nowMs: number,
  ): void {
    const existing = targetMap.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
      targetMap.set(key, {
        count: 1,
        resetAtMs: nowMs + windowSeconds * 1000,
      });
      return;
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many authentication attempts. Please retry later.',
          retry_after_seconds: retryAfterSeconds,
        },
        429,
      );
    }

    existing.count += 1;
    targetMap.set(key, existing);
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
    const uid = String(payload.sub || payload.user_id || '').trim() || 'unknown-user';
    const email =
      String(payload.email || '')
        .trim()
        .toLowerCase() || 'unknown@local';
    const roles = this.resolveRoles(payload, email, uid);

    const identity: VerifiedIdentity = {
      uid,
      email,
      roles: roles.length > 0 ? roles : ['user'],
      tenantId: tenantResolution.tenantId,
      access: {
        tenantType: 'user',
        accessTier: 'free',
        premiumActive: false,
        writeAccess: false,
        lifetimePremium: false,
        trialEndsAt: null,
        premiumUntil: null,
      },
      ...(String(payload.jti || '').trim() ? { tokenId: String(payload.jti).trim() } : {}),
      raw: payload,
    };
    identity.access = await this.resolveAccessProfile(identity.tenantId, identity.roles);
    return identity;
  }

  async issueAgentToken(input: {
    tenantId: string;
    agentId: string;
    pairedByUserId?: string;
  }): Promise<{ token: string; expiresAt: string }> {
    const tenantId = this.normalizeTenantId(input.tenantId);
    const agentId = String(input.agentId || '').trim();
    if (!agentId) {
      throw new BadRequestException({
        code: 'AUTH_AGENT_ID_REQUIRED',
        message: 'agent_id is required',
      });
    }
    if (!this.agentJwtSecret) {
      throw new InternalServerErrorException({
        code: 'AUTH_AGENT_TOKEN_SECRET_MISSING',
        message: 'AGENT_AUTH_SECRET (or SUPABASE_JWT_SECRET/JWT_SECRET) is required',
      });
    }

    const ttlSeconds = Number.isFinite(this.agentTokenTtlSeconds)
      ? Math.max(60, Math.min(86_400, Math.trunc(this.agentTokenTtlSeconds || 900)))
      : 900;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + ttlSeconds;
    const key = createSecretKey(Buffer.from(this.agentJwtSecret));
    const token = await new SignJWT({
      role: 'agent',
      tenant_id: tenantId,
      agent_id: agentId,
      ...(String(input.pairedByUserId || '').trim()
        ? { paired_by_user_id: String(input.pairedByUserId).trim() }
        : {}),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.agentJwtIssuer)
      .setAudience(
        this.agentJwtAudience.length > 1
          ? this.agentJwtAudience
          : this.agentJwtAudience[0] || 'botmox-agent',
      )
      .setSubject(`agent:${agentId}`)
      .setJti(randomUUID())
      .setIssuedAt(nowSeconds)
      .setExpirationTime(expSeconds)
      .sign(key);

    return {
      token,
      expiresAt: new Date(expSeconds * 1000).toISOString(),
    };
  }

  async verifyAgentBearerToken(token: string | null | undefined): Promise<VerifiedIdentity | null> {
    const normalized = String(token || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!normalized || !this.agentJwtSecret) {
      return null;
    }

    const verifyOptions: JWTVerifyOptions = {};
    if (this.agentJwtIssuer) {
      verifyOptions.issuer = this.agentJwtIssuer;
    }
    if (this.agentJwtAudience.length > 0) {
      verifyOptions.audience = this.agentJwtAudience;
    }

    let payload: JWTPayload | null = null;
    try {
      const key = createSecretKey(Buffer.from(this.agentJwtSecret));
      const verified = await jwtVerify(normalized, key, verifyOptions);
      payload = verified.payload;
    } catch {
      return null;
    }

    const tenantResolution = this.resolveTenantId(payload);
    const tenantId = tenantResolution.tenantId;
    const agentId = String(payload.agent_id || '').trim();
    if (!tenantResolution.hasExplicitTenant || !tenantId || !agentId) {
      return null;
    }

    return {
      uid: String(payload.sub || `agent:${agentId}`).trim() || `agent:${agentId}`,
      email: `agent:${agentId}@local`,
      roles: ['agent'],
      tenantId,
      access: {
        tenantType: 'user',
        accessTier: 'premium',
        premiumActive: true,
        writeAccess: true,
        lifetimePremium: true,
        trialEndsAt: null,
        premiumUntil: null,
      },
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
      access: {
        tenantType: 'user',
        accessTier: 'trial',
        premiumActive: true,
        writeAccess: true,
        lifetimePremium: false,
        trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        premiumUntil: null,
      },
      raw: {},
    };
  }

  isAdmin(roles: string[] | null | undefined): boolean {
    const normalized = Array.isArray(roles)
      ? roles
          .map((role) =>
            String(role || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
      : [];
    return (
      normalized.includes('admin') ||
      normalized.includes('owner') ||
      normalized.includes('service_role')
    );
  }

  async createUserWithTenant(input: CreateUserInput): Promise<CreatedUserResult> {
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    const password = String(input.password || '');
    if (!email || !password) {
      throw new BadRequestException({
        code: 'AUTH_CREATE_USER_INVALID_INPUT',
        message: 'Email and password are required',
      });
    }
    this.ensurePasswordPolicy(password);
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin user create flow',
      });
    }

    const tenantId = this.normalizeTenantId(input.tenantId || `t_${randomUUID()}`);
    const roles = Array.isArray(input.roles)
      ? Array.from(
          new Set(
            input.roles
              .map((value) =>
                String(value || '')
                  .trim()
                  .toLowerCase(),
              )
              .filter(Boolean),
          ),
        )
      : ['user'];

    const response = await fetch(`${this.supabaseApiUrl.replace(/\/+$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: this.supabaseServiceRoleKey,
        authorization: `Bearer ${this.supabaseServiceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          tenant_id: tenantId,
          tenant_type: 'user',
          roles,
        },
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      user?: {
        id?: unknown;
        email?: unknown;
      };
      id?: unknown;
      email?: unknown;
      error?: unknown;
      error_description?: unknown;
      msg?: unknown;
    } | null;

    if (!response.ok) {
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin create user failed (${response.status})`;
      const normalizedMessage = message.toLowerCase();
      const isEmailAlreadyExists =
        normalizedMessage.includes('already been registered') ||
        normalizedMessage.includes('already registered') ||
        normalizedMessage.includes('user already exists') ||
        normalizedMessage.includes('email already exists');
      if (isEmailAlreadyExists) {
        throw new ConflictException({
          code: 'AUTH_EMAIL_ALREADY_EXISTS',
          message: 'Account with this email already exists',
        });
      }
      throw new BadRequestException({
        code: 'AUTH_CREATE_USER_FAILED',
        message,
      });
    }

    const created = payload?.user ?? payload ?? {};
    await this.ensureTenantAccessCreated(tenantId);
    return {
      id: String(created.id || '').trim(),
      email: String(created.email || email)
        .trim()
        .toLowerCase(),
      tenantId,
    };
  }

  async signInWithPassword(credentials: {
    login: string;
    password: string;
  }): Promise<{ accessToken: string; identity: VerifiedIdentity }> {
    const login = String(credentials.login || '').trim();
    const password = String(credentials.password || '');
    if (!login || !password) {
      throw new BadRequestException({
        code: 'AUTH_CREDENTIALS_REQUIRED',
        message: 'Login and password are required',
      });
    }

    const baseUrl = this.supabaseApiUrl.replace(/\/+$/, '');
    if (!baseUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required for quick-pair',
      });
    }
    if (!this.supabaseApiKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_KEY_MISSING',
        message: 'SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required for quick-pair',
      });
    }

    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: this.supabaseApiKey,
        authorization: `Bearer ${this.supabaseApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: login,
        password,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error_description?: unknown;
        msg?: unknown;
        error?: unknown;
      } | null;
      const message =
        String(payload?.error_description || payload?.msg || payload?.error || '').trim() ||
        'Invalid Bot-Mox account credentials';

      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message,
      });
    }

    const payload = (await response.json()) as { access_token?: unknown };
    const accessToken = String(payload?.access_token || '').trim();
    if (!accessToken) {
      throw new InternalServerErrorException({
        code: 'AUTH_ACCESS_TOKEN_MISSING',
        message: 'Supabase sign-in did not return access_token',
      });
    }

    const identity = await this.verifyBearerToken(`Bearer ${accessToken}`);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_VERIFICATION_FAILED',
        message: 'Supabase token verification failed for quick-pair',
      });
    }

    return {
      accessToken,
      identity,
    };
  }

  private mapAdminUserSummary(raw: unknown): AdminUserSummary | null {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const appMetadata =
      row.app_metadata && typeof row.app_metadata === 'object'
        ? (row.app_metadata as Record<string, unknown>)
        : {};
    const roles = Array.isArray(appMetadata.roles)
      ? appMetadata.roles
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
      : [];
    const tenantIdRaw = String(appMetadata.tenant_id || '')
      .trim()
      .toLowerCase();
    const email = String(row.email || '')
      .trim()
      .toLowerCase();
    const id = String(row.id || '').trim();
    if (!id || !email) {
      return null;
    }
    const bannedUntilRaw = String(row.banned_until || '').trim();
    const bannedUntilDate = bannedUntilRaw ? new Date(bannedUntilRaw) : null;
    const disabled = Boolean(
      bannedUntilDate &&
        !Number.isNaN(bannedUntilDate.getTime()) &&
        bannedUntilDate.getTime() > Date.now(),
    );
    return {
      id,
      email,
      tenantId: tenantIdRaw || null,
      roles,
      createdAt: String(row.created_at || '').trim() || null,
      lastSignInAt: String(row.last_sign_in_at || '').trim() || null,
      bannedUntil: bannedUntilRaw || null,
      disabled,
    };
  }

  async listUsers(input: { query?: string; limit?: number }): Promise<AdminUserSummary[]> {
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin users list',
      });
    }

    const query = String(input.query || '')
      .trim()
      .toLowerCase();
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(1000, Math.trunc(input.limit || 100)))
      : 100;

    const response = await fetch(
      `${this.supabaseApiUrl.replace(/\/+$/, '')}/auth/v1/admin/users?page=1&per_page=${limit}`,
      {
        method: 'GET',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      users?: unknown[];
      error?: unknown;
      error_description?: unknown;
      msg?: unknown;
    } | null;

    if (!response.ok) {
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin list users failed (${response.status})`;
      throw new BadRequestException({
        code: 'AUTH_LIST_USERS_FAILED',
        message,
      });
    }

    const users = Array.isArray(payload?.users) ? payload.users : [];
    const rows = users
      .map((raw) => this.mapAdminUserSummary(raw))
      .filter((row): row is AdminUserSummary => row !== null);

    if (!query) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.email.includes(query) ||
        row.id.includes(query) ||
        String(row.tenantId || '').includes(query),
    );
  }

  async getUserById(userId: string): Promise<AdminUserSummary | null> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new BadRequestException({
        code: 'AUTH_GET_USER_INVALID_INPUT',
        message: 'user_id is required',
      });
    }
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin get user',
      });
    }

    const response = await fetch(
      `${this.supabaseApiUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(normalizedUserId)}`,
      {
        method: 'GET',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
      },
    );

    if (response.status === 404) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as {
      user?: unknown;
      error?: unknown;
      error_description?: unknown;
      msg?: unknown;
    } | null;
    if (!response.ok) {
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin get user failed (${response.status})`;
      throw new BadRequestException({
        code: 'AUTH_GET_USER_FAILED',
        message,
      });
    }

    const mapped = this.mapAdminUserSummary(payload?.user ?? payload ?? null);
    return mapped;
  }

  async resetUserPassword(input: { userId: string; newPassword: string }): Promise<void> {
    const userId = String(input.userId || '').trim();
    const newPassword = String(input.newPassword || '');
    if (!userId || !newPassword) {
      throw new BadRequestException({
        code: 'AUTH_RESET_PASSWORD_INVALID_INPUT',
        message: 'user_id and new_password are required',
      });
    }
    this.ensurePasswordPolicy(newPassword);
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin password reset',
      });
    }

    const response = await fetch(
      `${this.supabaseApiUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        error_description?: unknown;
        msg?: unknown;
      } | null;
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin reset password failed (${response.status})`;
      throw new BadRequestException({
        code: 'AUTH_RESET_PASSWORD_FAILED',
        message,
      });
    }
  }

  async setUserRoles(input: {
    userId: string;
    roles: string[];
  }): Promise<{ userId: string; roles: string[] }> {
    const userId = String(input.userId || '').trim();
    const roles = Array.from(
      new Set(
        (Array.isArray(input.roles) ? input.roles : [])
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    if (!userId || roles.length === 0) {
      throw new BadRequestException({
        code: 'AUTH_SET_ROLES_INVALID_INPUT',
        message: 'user_id and roles are required',
      });
    }
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin role update',
      });
    }

    const baseUrl = this.supabaseApiUrl.replace(/\/+$/, '');
    const userResponse = await fetch(
      `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
      },
    );
    const userPayload = (await userResponse.json().catch(() => null)) as {
      user?: { app_metadata?: Record<string, unknown> };
      app_metadata?: Record<string, unknown>;
      error?: unknown;
      error_description?: unknown;
      msg?: unknown;
    } | null;
    if (!userResponse.ok) {
      const message =
        String(
          userPayload?.msg || userPayload?.error_description || userPayload?.error || '',
        ).trim() || `Supabase admin get user failed (${userResponse.status})`;
      throw new BadRequestException({
        code: 'AUTH_SET_ROLES_FETCH_USER_FAILED',
        message,
      });
    }

    const appMetadataRaw =
      (userPayload?.user?.app_metadata && typeof userPayload.user.app_metadata === 'object'
        ? userPayload.user.app_metadata
        : userPayload?.app_metadata && typeof userPayload.app_metadata === 'object'
          ? userPayload.app_metadata
          : {}) || {};
    const appMetadata = { ...appMetadataRaw, roles };

    const updateResponse = await fetch(
      `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          app_metadata: appMetadata,
        }),
      },
    );
    if (!updateResponse.ok) {
      const updatePayload = (await updateResponse.json().catch(() => null)) as {
        error?: unknown;
        error_description?: unknown;
        msg?: unknown;
      } | null;
      const message =
        String(
          updatePayload?.msg || updatePayload?.error_description || updatePayload?.error || '',
        ).trim() || `Supabase admin set roles failed (${updateResponse.status})`;
      throw new BadRequestException({
        code: 'AUTH_SET_ROLES_FAILED',
        message,
      });
    }

    return { userId, roles };
  }

  async setUserDisabled(input: {
    userId: string;
    disabled: boolean;
  }): Promise<{ userId: string; disabled: boolean }> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new BadRequestException({
        code: 'AUTH_SET_USER_DISABLED_INVALID_INPUT',
        message: 'user_id is required',
      });
    }
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin disable/enable flow',
      });
    }

    const baseUrl = this.supabaseApiUrl.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        apikey: this.supabaseServiceRoleKey,
        authorization: `Bearer ${this.supabaseServiceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ban_duration: input.disabled ? '876000h' : 'none',
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        error_description?: unknown;
        msg?: unknown;
      } | null;
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin set user disabled failed (${response.status})`;
      throw new BadRequestException({
        code: 'AUTH_SET_USER_DISABLED_FAILED',
        message,
      });
    }

    return { userId, disabled: input.disabled };
  }

  async forceUserLogout(input: { userId: string }): Promise<{ userId: string }> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new BadRequestException({
        code: 'AUTH_FORCE_LOGOUT_INVALID_INPUT',
        message: 'user_id is required',
      });
    }
    if (!this.supabaseApiUrl) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_URL_MISSING',
        message: 'SUPABASE_PUBLIC_URL or SUPABASE_URL is required',
      });
    }
    if (!this.supabaseServiceRoleKey) {
      throw new InternalServerErrorException({
        code: 'AUTH_SUPABASE_SERVICE_ROLE_KEY_MISSING',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for admin force logout',
      });
    }

    const response = await fetch(
      `${this.supabaseApiUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}/logout`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        error_description?: unknown;
        msg?: unknown;
      } | null;
      const message =
        String(payload?.msg || payload?.error_description || payload?.error || '').trim() ||
        `Supabase admin force logout failed (${response.status})`;
      throw new BadRequestException({
        code: 'AUTH_FORCE_LOGOUT_FAILED',
        message,
      });
    }

    return { userId };
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

  private ensurePasswordPolicy(password: string): void {
    const value = String(password || '');
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    if (value.length < 8 || value.length > 256 || !hasLower || !hasUpper || !hasDigit) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_POLICY_FAILED',
        message:
          'Password must be 8-256 chars and include uppercase, lowercase, and digit characters',
      });
    }
  }

  private normalizeTenantId(value: string): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new BadRequestException({
        code: 'AUTH_TENANT_ID_REQUIRED',
        message: 'tenant_id is required',
      });
    }
    return normalized;
  }

  async grantPremium(input: {
    tenantId: string;
    lifetime?: boolean;
    days?: number;
  }): Promise<AccessProfile> {
    const tenantId = this.normalizeTenantId(input.tenantId);
    if (!this.prisma) {
      throw new InternalServerErrorException({
        code: 'AUTH_DB_UNAVAILABLE',
        message: 'Database is unavailable for premium update',
      });
    }

    const days = Number.isFinite(input.days) ? Math.max(1, Math.trunc(input.days || 30)) : 30;
    const lifetime = input.lifetime === true;
    const premiumUntil = lifetime ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.withTenantContext(tenantId, async (tx) => {
      await tx.tenantAccountAccess.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: 'premium',
          lifetimePremium: lifetime,
          premiumUntil,
        },
        update: {
          plan: 'premium',
          lifetimePremium: lifetime,
          premiumUntil,
        },
      });
    });

    return this.resolveAccessProfile(tenantId, []);
  }

  async revokePremium(input: { tenantId: string }): Promise<AccessProfile> {
    const tenantId = this.normalizeTenantId(input.tenantId);
    if (!this.prisma) {
      throw new InternalServerErrorException({
        code: 'AUTH_DB_UNAVAILABLE',
        message: 'Database is unavailable for premium revoke',
      });
    }

    await this.prisma.withTenantContext(tenantId, async (tx) => {
      await tx.tenantAccountAccess.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: 'free',
          trialStartedAt: null,
          trialEndsAt: null,
          trialUsedAt: new Date(),
          lifetimePremium: false,
          premiumUntil: null,
        },
        update: {
          plan: 'free',
          trialStartedAt: null,
          trialEndsAt: null,
          lifetimePremium: false,
          premiumUntil: null,
        },
      });
    });

    return this.resolveAccessProfile(tenantId, []);
  }

  async startTrial(input: { tenantId: string }): Promise<AccessProfile> {
    const tenantId = this.normalizeTenantId(input.tenantId);
    if (!this.prisma) {
      throw new InternalServerErrorException({
        code: 'AUTH_DB_UNAVAILABLE',
        message: 'Database is unavailable for trial activation',
      });
    }

    const now = new Date();
    const trialHours = Number.isFinite(this.trialDurationHours)
      ? Math.max(1, Math.min(168, Math.trunc(this.trialDurationHours)))
      : 24;
    const trialEndsAt = new Date(now.getTime() + trialHours * 60 * 60 * 1000);

    await this.prisma.withTenantContext(tenantId, async (tx) => {
      const existing = await tx.tenantAccountAccess.findUnique({
        where: { tenantId },
      });

      if (!existing) {
        await tx.tenantAccountAccess.create({
          data: {
            tenantId,
            plan: 'trial',
            trialStartedAt: now,
            trialEndsAt,
            trialUsedAt: now,
          },
        });
        return;
      }

      const premiumUntilMs = existing.premiumUntil ? existing.premiumUntil.getTime() : null;
      const trialEndsAtMs = existing.trialEndsAt ? existing.trialEndsAt.getTime() : null;
      const lifetimePremium = existing.lifetimePremium === true;
      const premiumActive =
        lifetimePremium ||
        (premiumUntilMs !== null && Number.isFinite(premiumUntilMs) && premiumUntilMs > Date.now());
      const activeTrial =
        trialEndsAtMs !== null && Number.isFinite(trialEndsAtMs) && trialEndsAtMs > Date.now();

      if (premiumActive || activeTrial) {
        return;
      }

      if (existing.trialUsedAt) {
        throw new ConflictException({
          code: 'AUTH_TRIAL_ALREADY_USED',
          message: 'Trial has already been used for this account',
        });
      }

      await tx.tenantAccountAccess.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: 'trial',
          trialStartedAt: now,
          trialEndsAt,
          trialUsedAt: now,
        },
        update: {
          plan: 'trial',
          trialStartedAt: now,
          trialEndsAt,
          trialUsedAt: now,
        },
      });
    });

    return this.resolveAccessProfile(tenantId, []);
  }

  private async ensureTenantAccessCreated(tenantId: string): Promise<void> {
    if (!this.prisma) {
      return;
    }

    try {
      await this.prisma.withTenantContext(tenantId, async (tx) => {
        const existing = await tx.tenantAccountAccess.findUnique({
          where: { tenantId },
        });
        if (existing) {
          return;
        }
        await tx.tenantAccountAccess.create({
          data: {
            tenantId,
            plan: 'free',
            trialStartedAt: null,
            trialEndsAt: null,
            trialUsedAt: null,
            lifetimePremium: false,
            premiumUntil: null,
          },
        });
      });
    } catch (error) {
      if (isPrismaMissingStorageError(error)) {
        return;
      }
      throw error;
    }
  }

  private async resolveAccessProfile(tenantId: string, roles: string[]): Promise<AccessProfile> {
    if (this.isAdmin(roles)) {
      return {
        tenantType: 'user',
        accessTier: 'admin',
        premiumActive: true,
        writeAccess: true,
        lifetimePremium: true,
        trialUsed: false,
        trialEndsAt: null,
        premiumUntil: null,
      };
    }

    if (!this.prisma) {
      return {
        tenantType: 'user',
        accessTier: 'free',
        premiumActive: false,
        writeAccess: false,
        lifetimePremium: false,
        trialUsed: false,
        trialEndsAt: null,
        premiumUntil: null,
      };
    }

    await this.ensureTenantAccessCreated(tenantId);
    let record: {
      trialEndsAt?: Date | null;
      premiumUntil?: Date | null;
      lifetimePremium?: boolean | null;
      trialUsedAt?: Date | null;
    } | null = null;
    try {
      record = await this.prisma.withTenantContext(tenantId, async (tx) => {
        return tx.tenantAccountAccess.findUnique({
          where: { tenantId },
        });
      });
    } catch (error) {
      if (isPrismaMissingStorageError(error)) {
        return {
          tenantType: 'user',
          accessTier: 'free',
          premiumActive: false,
          writeAccess: false,
          lifetimePremium: false,
          trialUsed: false,
          trialEndsAt: null,
          premiumUntil: null,
        };
      }
      throw error;
    }

    const nowMs = Date.now();
    const trialEndsAtMs = record?.trialEndsAt ? record.trialEndsAt.getTime() : null;
    const premiumUntilMs = record?.premiumUntil ? record.premiumUntil.getTime() : null;
    const trialActive = trialEndsAtMs !== null && trialEndsAtMs > nowMs;
    const premiumWindowActive = premiumUntilMs !== null && premiumUntilMs > nowMs;
    const lifetimePremium = record?.lifetimePremium === true;
    const paidPremiumActive = lifetimePremium || premiumWindowActive;
    const premiumActive = paidPremiumActive || trialActive;

    const accessTier: AccessProfile['accessTier'] = paidPremiumActive
      ? 'premium'
      : trialActive
        ? 'trial'
        : 'free';

    return {
      tenantType: 'user',
      accessTier,
      premiumActive,
      writeAccess: premiumActive,
      lifetimePremium,
      trialUsed: Boolean(record?.trialUsedAt),
      trialEndsAt: record?.trialEndsAt ? record.trialEndsAt.toISOString() : null,
      premiumUntil: record?.premiumUntil ? record.premiumUntil.toISOString() : null,
    };
  }

  private resolveRoles(payload: JWTPayload, email: string, uid: string): string[] {
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
    if (
      this.adminEmails.has(
        String(email || '')
          .trim()
          .toLowerCase(),
      )
    ) {
      result.add('admin');
    }
    if (this.adminUserIds.has(String(uid || '').trim())) {
      result.add('admin');
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
