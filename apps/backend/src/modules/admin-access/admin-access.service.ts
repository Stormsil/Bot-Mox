import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(input: { limit?: number; query?: string }): Promise<Record<string, unknown>[]> {
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(1000, Math.trunc(input.limit || 100)))
      : 100;
    const query = String(input.query || '')
      .trim()
      .toLowerCase();

    const rows = await this.prisma.withSystemContext(async () => {
      return this.prisma.tenantAccountAccess.findMany({
        ...(query
          ? {
              where: {
                tenantId: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
            }
          : {}),
        orderBy: {
          updatedAt: 'desc',
        },
        take: limit,
      });
    });

    return rows.map((row) => {
      const nowMs = Date.now();
      const premiumUntilMs = row.premiumUntil ? row.premiumUntil.getTime() : null;
      const trialEndsAtMs = row.trialEndsAt ? row.trialEndsAt.getTime() : null;
      const premiumActive =
        row.lifetimePremium ||
        (premiumUntilMs !== null && premiumUntilMs > nowMs) ||
        (trialEndsAtMs !== null && trialEndsAtMs > nowMs);

      return {
        tenant_id: row.tenantId,
        plan: row.plan,
        premium_active: premiumActive,
        lifetime_premium: row.lifetimePremium,
        trial_started_at: row.trialStartedAt ? row.trialStartedAt.toISOString() : null,
        trial_ends_at: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
        premium_until: row.premiumUntil ? row.premiumUntil.toISOString() : null,
        updated_at: row.updatedAt.toISOString(),
      };
    });
  }

  async getTenantAccessMap(tenantIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    const normalizedTenantIds = Array.from(
      new Set(
        tenantIds
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    if (normalizedTenantIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.withSystemContext(async () => {
      return this.prisma.tenantAccountAccess.findMany({
        where: {
          tenantId: {
            in: normalizedTenantIds,
          },
        },
      });
    });

    const nowMs = Date.now();
    const result = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const premiumUntilMs = row.premiumUntil ? row.premiumUntil.getTime() : null;
      const trialEndsAtMs = row.trialEndsAt ? row.trialEndsAt.getTime() : null;
      const premiumActive =
        row.lifetimePremium ||
        (premiumUntilMs !== null && premiumUntilMs > nowMs) ||
        (trialEndsAtMs !== null && trialEndsAtMs > nowMs);

      result.set(row.tenantId, {
        plan: row.plan,
        premium_active: premiumActive,
        lifetime_premium: row.lifetimePremium,
        trial_started_at: row.trialStartedAt ? row.trialStartedAt.toISOString() : null,
        trial_ends_at: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
        premium_until: row.premiumUntil ? row.premiumUntil.toISOString() : null,
        updated_at: row.updatedAt.toISOString(),
      });
    }

    return result;
  }
}
