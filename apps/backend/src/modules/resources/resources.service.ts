import { Injectable, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { buildResourceComputedStatusFields } from '../common/status-computation';
import { DOMAIN_EVENT_TYPES } from '../eventing/domain-events.contracts';
import { DurableEventBusService } from '../eventing/durable-event-bus.service';
import { ResourcesRepository } from './resources.repository';

type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';
type ResourceRecord = Record<string, unknown>;

export interface ResourceListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
  country?: string | undefined;
  country_code?: string | undefined;
  bot_id?: string | undefined;
}

export interface ResourceListResult {
  items: ResourceRecord[];
  total: number;
  page: number;
  limit: number;
}

type ResourceAggregateStatus = 'none' | 'active' | 'expiring' | 'expired' | 'banned';

type ResourceStatusProjection = {
  status: ResourceAggregateStatus;
  label: string;
  color: 'default' | 'success' | 'warning' | 'error';
  sort: number;
  days_remaining?: number;
};

export interface ResourcesStatusAggregateDto {
  generated_at: number;
  summary: {
    licenses: {
      total: number;
      active: number;
      expiring_soon: number;
      expired: number;
      unassigned: number;
    };
    proxies: {
      total: number;
      active: number;
      expiring_soon: number;
      expired: number;
      unassigned: number;
    };
    subscriptions: { total: number; active: number; expiring_soon: number; expired: number };
  };
  expiring_items: Array<{
    id: string;
    type: 'license' | 'proxy' | 'subscription';
    name: string;
    bot_id?: string;
    days_remaining: number;
    expires_at?: number;
  }>;
  by_bot: Record<
    string,
    {
      license_status: ResourceStatusProjection;
      proxy_status: ResourceStatusProjection;
      subscription_status: ResourceStatusProjection;
      subscriptions_summary: {
        total: number;
        active_count: number;
        next_expiry_days_remaining?: number;
        next_expiry_at?: number;
      };
    }
  >;
}

@Injectable()
export class ResourcesService {
  constructor(
    private readonly repository: ResourcesRepository,
    @Optional() private readonly eventBus?: DurableEventBusService,
  ) {}

  private normalizeSearchValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).toLowerCase();
    }

    return '';
  }

  private makeId(kind: ResourceKind): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${kind}-${stamp}-${random}`;
  }

  private applyListQuery(items: ResourceRecord[], query: ResourceListQuery): ResourceListResult {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();
    const equalityFilters = {
      status: typeof query.status === 'string' ? query.status.trim() : '',
      type: typeof query.type === 'string' ? query.type.trim() : '',
      country: typeof query.country === 'string' ? query.country.trim() : '',
      country_code: typeof query.country_code === 'string' ? query.country_code.trim() : '',
      bot_id: typeof query.bot_id === 'string' ? query.bot_id.trim() : '',
    };

    let data = [...items];

    data = data.filter((item) => {
      for (const [key, expected] of Object.entries(equalityFilters)) {
        if (!expected) {
          continue;
        }
        const actual = String(item?.[key] ?? '').trim();
        if (actual !== expected) {
          return false;
        }
      }
      return true;
    });

    if (q) {
      data = data.filter((item) =>
        Object.values(item).some((value) => this.normalizeSearchValue(value).includes(q)),
      );
    }

    if (sort) {
      data.sort((left, right) => {
        const a = left?.[sort];
        const b = right?.[sort];

        if (a === b) return 0;
        if (a === undefined || a === null) return order === 'asc' ? -1 : 1;
        if (b === undefined || b === null) return order === 'asc' ? 1 : -1;
        if (a > b) return order === 'asc' ? 1 : -1;
        return order === 'asc' ? -1 : 1;
      });
    }

    const total = data.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      items: data.slice(start, end),
      total,
      page,
      limit,
    };
  }

  private mapDbRowToRecord(kind: ResourceKind, row: Record<string, unknown>): ResourceRecord {
    const id = String(row.id || '').trim();
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      const mapped = { ...(payload as ResourceRecord), ...(id ? { id } : {}) };
      return {
        ...mapped,
        ...buildResourceComputedStatusFields(kind, mapped),
      };
    }
    const mapped = id ? { id } : {};
    return {
      ...mapped,
      ...buildResourceComputedStatusFields(kind, mapped),
    };
  }

  async list(
    kind: ResourceKind,
    query: ResourceListQuery,
    tenantId: string,
  ): Promise<ResourceListResult> {
    const rows = await this.repository.list(tenantId, kind);
    const mapped = rows.map((row) => this.mapDbRowToRecord(kind, row));
    return this.applyListQuery(mapped, query);
  }

  async getById(kind: ResourceKind, id: string, tenantId: string): Promise<ResourceRecord | null> {
    const row = await this.repository.findById(tenantId, kind, id);
    if (!row) {
      return null;
    }
    return this.mapDbRowToRecord(kind, row);
  }

  async create(
    kind: ResourceKind,
    payload: ResourceRecord,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<ResourceRecord> {
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId(kind);

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const row = await this.repository.upsert({
      tenantId,
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(kind, row);
  }

  async update(
    kind: ResourceKind,
    id: string,
    payload: ResourceRecord,
    tenantId: string,
  ): Promise<ResourceRecord | null> {
    const dbCurrent = await this.repository.findById(tenantId, kind, id);
    const current = dbCurrent ? this.mapDbRowToRecord(kind, dbCurrent) : null;
    if (!current) {
      return null;
    }

    const nextRecord = {
      ...current,
      ...payload,
      id,
      updated_at: new Date().toISOString(),
    };

    const row = await this.repository.upsert({
      tenantId,
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(kind, row);
  }

  async remove(kind: ResourceKind, id: string, tenantId: string): Promise<boolean> {
    const aggregateId = `${kind}:${id}`;
    await this.eventBus?.publish({
      type: DOMAIN_EVENT_TYPES.RESOURCE_DELETE_REQUESTED,
      tenantId,
      aggregateId,
      payload: {
        kind,
        resourceId: id,
      },
    });

    try {
      const removed = await this.repository.delete(tenantId, kind, id);
      if (removed) {
        await this.eventBus?.publish({
          type: DOMAIN_EVENT_TYPES.RESOURCE_DELETED,
          tenantId,
          aggregateId,
          payload: {
            kind,
            resourceId: id,
          },
        });
      } else {
        await this.eventBus?.publish({
          type: DOMAIN_EVENT_TYPES.RESOURCE_DELETE_FAILED,
          tenantId,
          aggregateId,
          payload: {
            kind,
            resourceId: id,
            reason: 'not_found',
          },
        });
      }
      return removed;
    } catch (error) {
      await this.eventBus?.publish({
        type: DOMAIN_EVENT_TYPES.RESOURCE_DELETE_FAILED,
        tenantId,
        aggregateId,
        payload: {
          kind,
          resourceId: id,
          reason: 'repository_error',
          details: (error as Error)?.message || String(error),
        },
      });
      throw error;
    }
  }

  private toNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toStatusToken(value: unknown): ResourceAggregateStatus {
    if (
      value === 'active' ||
      value === 'expiring' ||
      value === 'expired' ||
      value === 'banned' ||
      value === 'none'
    ) {
      return value;
    }
    return 'none';
  }

  private mapStatusProjection(
    status: ResourceAggregateStatus,
    daysRemaining?: number,
  ): ResourceStatusProjection {
    if (status === 'banned') {
      return { status, label: 'Banned', color: 'error', sort: 1, days_remaining: 0 };
    }
    if (status === 'expired') {
      return { status, label: 'Expired', color: 'error', sort: 2, days_remaining: 0 };
    }
    if (status === 'expiring') {
      return {
        status,
        label: 'Expiring',
        color: 'warning',
        sort: 3,
        ...(daysRemaining !== undefined ? { days_remaining: daysRemaining } : {}),
      };
    }
    if (status === 'active') {
      return {
        status,
        label: 'Active',
        color: 'success',
        sort: 4,
        ...(daysRemaining !== undefined ? { days_remaining: daysRemaining } : {}),
      };
    }
    return { status: 'none', label: 'None', color: 'default', sort: 5 };
  }

  private aggregateTimedStatus(items: ResourceRecord[]): ResourceStatusProjection {
    if (items.length === 0) {
      return this.mapStatusProjection('none');
    }

    const expired = items.some((item) => this.toStatusToken(item.computed_status) === 'expired');
    if (expired) {
      return this.mapStatusProjection('expired', 0);
    }

    const expiringDays = items
      .filter((item) => this.toStatusToken(item.computed_status) === 'expiring')
      .map((item) => this.toNumber(item.days_remaining))
      .filter((value): value is number => value !== undefined && value > 0)
      .sort((left, right) => left - right);
    if (expiringDays.length > 0) {
      return this.mapStatusProjection('expiring', expiringDays[0]);
    }

    const activeDays = items
      .map((item) => this.toNumber(item.days_remaining))
      .filter((value): value is number => value !== undefined && value > 0)
      .sort((left, right) => left - right);
    return this.mapStatusProjection('active', activeDays[0]);
  }

  private aggregateProxyStatus(proxy: ResourceRecord | undefined): ResourceStatusProjection {
    if (!proxy) {
      return this.mapStatusProjection('none');
    }
    const status = this.toStatusToken(proxy.computed_status);
    if (status === 'banned') {
      return this.mapStatusProjection('banned', 0);
    }
    if (status === 'expired') {
      return this.mapStatusProjection('expired', 0);
    }
    if (status === 'expiring') {
      return this.mapStatusProjection('expiring', this.toNumber(proxy.days_remaining));
    }
    if (status === 'active') {
      return this.mapStatusProjection('active', this.toNumber(proxy.days_remaining));
    }
    return this.mapStatusProjection('none');
  }

  async getStatusAggregates(tenantId: string): Promise<ResourcesStatusAggregateDto> {
    const now = Date.now();
    const [licensesRows, proxiesRows, subscriptionsRows] = await Promise.all([
      this.repository.list(tenantId, 'licenses'),
      this.repository.list(tenantId, 'proxies'),
      this.repository.list(tenantId, 'subscriptions'),
    ]);

    const licenses = licensesRows.map((row) => this.mapDbRowToRecord('licenses', row));
    const proxies = proxiesRows.map((row) => this.mapDbRowToRecord('proxies', row));
    const subscriptions = subscriptionsRows.map((row) =>
      this.mapDbRowToRecord('subscriptions', row),
    );

    const expiringItems: ResourcesStatusAggregateDto['expiring_items'] = [];
    const proxiesByBot = new Map<string, ResourceRecord>();
    const subscriptionsByBot = new Map<string, ResourceRecord[]>();
    const licensesByBot = new Map<string, ResourceRecord[]>();

    const summary = {
      licenses: { total: licenses.length, active: 0, expiring_soon: 0, expired: 0, unassigned: 0 },
      proxies: { total: proxies.length, active: 0, expiring_soon: 0, expired: 0, unassigned: 0 },
      subscriptions: { total: subscriptions.length, active: 0, expiring_soon: 0, expired: 0 },
    };

    for (const license of licenses) {
      const status = this.toStatusToken(license.computed_status);
      if (status === 'active') summary.licenses.active += 1;
      if (status === 'expired') summary.licenses.expired += 1;
      if (license.is_expiring_soon && status !== 'expired') summary.licenses.expiring_soon += 1;

      const botIds = Array.isArray(license.bot_ids)
        ? license.bot_ids.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      if (botIds.length === 0) {
        summary.licenses.unassigned += 1;
      }
      for (const botId of botIds) {
        const existing = licensesByBot.get(botId) ?? [];
        existing.push(license);
        licensesByBot.set(botId, existing);
      }

      const daysRemaining = this.toNumber(license.days_remaining);
      if (status === 'expiring' && daysRemaining !== undefined && daysRemaining > 0) {
        const expiresAt = this.toNumber(license.expires_at);
        expiringItems.push({
          id: String(license.id || ''),
          type: 'license',
          name: `License (${String(license.type || 'unknown')})`,
          ...(botIds[0] ? { bot_id: botIds[0] } : {}),
          days_remaining: daysRemaining,
          ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
        });
      }
    }

    for (const proxy of proxies) {
      const status = this.toStatusToken(proxy.computed_status);
      if (status === 'active') summary.proxies.active += 1;
      if (status === 'expired') summary.proxies.expired += 1;
      if (proxy.is_expiring_soon && status !== 'expired' && status !== 'banned') {
        summary.proxies.expiring_soon += 1;
      }

      const botId = typeof proxy.bot_id === 'string' ? proxy.bot_id.trim() : '';
      if (!botId) {
        summary.proxies.unassigned += 1;
      } else {
        proxiesByBot.set(botId, proxy);
      }

      const daysRemaining = this.toNumber(proxy.days_remaining);
      if (status === 'expiring' && daysRemaining !== undefined && daysRemaining > 0) {
        const expiresAt = this.toNumber(proxy.expires_at);
        expiringItems.push({
          id: String(proxy.id || ''),
          type: 'proxy',
          name: `Proxy (${String(proxy.ip || '')}:${String(proxy.port || '')})`,
          ...(botId ? { bot_id: botId } : {}),
          days_remaining: daysRemaining,
          ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
        });
      }
    }

    for (const subscription of subscriptions) {
      const status = this.toStatusToken(subscription.computed_status);
      if (status === 'active') summary.subscriptions.active += 1;
      if (status === 'expired') summary.subscriptions.expired += 1;
      if (subscription.is_expiring_soon && status !== 'expired') {
        summary.subscriptions.expiring_soon += 1;
      }

      const botId = typeof subscription.bot_id === 'string' ? subscription.bot_id.trim() : '';
      if (botId) {
        const existing = subscriptionsByBot.get(botId) ?? [];
        existing.push(subscription);
        subscriptionsByBot.set(botId, existing);
      }

      const daysRemaining = this.toNumber(subscription.days_remaining);
      if (status === 'expiring' && daysRemaining !== undefined && daysRemaining > 0) {
        const expiresAt = this.toNumber(subscription.expires_at);
        expiringItems.push({
          id: String(subscription.id || ''),
          type: 'subscription',
          name: `Subscription (${String(subscription.type || 'unknown')})`,
          ...(botId ? { bot_id: botId } : {}),
          days_remaining: daysRemaining,
          ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
        });
      }
    }

    expiringItems.sort((left, right) => left.days_remaining - right.days_remaining);

    const byBot: ResourcesStatusAggregateDto['by_bot'] = {};
    const allBotIds = new Set<string>([
      ...[...licensesByBot.keys()],
      ...[...proxiesByBot.keys()],
      ...[...subscriptionsByBot.keys()],
    ]);
    for (const botId of allBotIds) {
      const botSubscriptions = subscriptionsByBot.get(botId) ?? [];
      const activeSubscriptions = botSubscriptions.filter(
        (item) => this.toStatusToken(item.computed_status) === 'active',
      );
      const nextSubscription = [...activeSubscriptions]
        .map((item) => ({
          expiresAt: this.toNumber(item.expires_at),
          daysRemaining: this.toNumber(item.days_remaining),
        }))
        .filter((item) => item.expiresAt !== undefined)
        .sort((left, right) => (left.expiresAt as number) - (right.expiresAt as number))[0];

      byBot[botId] = {
        license_status: this.aggregateTimedStatus(licensesByBot.get(botId) ?? []),
        proxy_status: this.aggregateProxyStatus(proxiesByBot.get(botId)),
        subscription_status: this.aggregateTimedStatus(botSubscriptions),
        subscriptions_summary: {
          total: botSubscriptions.length,
          active_count: activeSubscriptions.length,
          ...(nextSubscription?.daysRemaining !== undefined
            ? { next_expiry_days_remaining: nextSubscription.daysRemaining }
            : {}),
          ...(nextSubscription?.expiresAt !== undefined
            ? { next_expiry_at: nextSubscription.expiresAt }
            : {}),
        },
      };
    }

    return {
      generated_at: now,
      summary,
      expiring_items: expiringItems,
      by_bot: byBot,
    };
  }
}
