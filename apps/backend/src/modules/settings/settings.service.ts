import {
  type settingsApiKeysMutationSchema,
  settingsApiKeysSchema,
  type settingsNotificationEventsMutationSchema,
  settingsNotificationEventsSchema,
  type settingsProxyMutationSchema,
  settingsProxySchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SettingsRepository } from './settings.repository';

type SettingsApiKeys = import('zod').infer<typeof settingsApiKeysSchema>;
type SettingsApiKeysMutation = import('zod').infer<typeof settingsApiKeysMutationSchema>;
type SettingsProxy = import('zod').infer<typeof settingsProxySchema>;
type SettingsProxyMutation = import('zod').infer<typeof settingsProxyMutationSchema>;
type SettingsNotificationEvents = import('zod').infer<typeof settingsNotificationEventsSchema>;
type SettingsNotificationEventsMutation = import('zod').infer<
  typeof settingsNotificationEventsMutationSchema
>;

const SETTINGS_API_KEYS_PATH = 'settings/api_keys';
const SETTINGS_PROXY_PATH = 'settings/proxy';
const SETTINGS_NOTIFICATION_EVENTS_PATH = 'settings/notifications/events';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private clone<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private mapDbRowPayload(row: Record<string, unknown>): unknown {
    return this.clone(row.payload);
  }

  private readPath<T>(
    tenantId: string,
    path: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): Promise<T | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository.findByPath(normalizedTenantId, path).then((row) => {
      if (!row) {
        return null;
      }
      const parsed = schema.safeParse(this.mapDbRowPayload(row));
      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    });
  }

  private mergePath<T>(
    tenantId: string,
    path: string,
    payload: unknown,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): Promise<T> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);

    const computeNext = (current: unknown): unknown => {
      let next: unknown = payload;
      if (isPlainObject(current) && isPlainObject(payload)) {
        next = { ...current, ...payload };
      }
      return next;
    };

    return this.repository.findByPath(normalizedTenantId, path).then(async (existing) => {
      const current = existing ? this.mapDbRowPayload(existing) : null;
      const next = computeNext(current);
      const row = await this.repository.upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.clone(next) as Prisma.InputJsonValue,
      });
      const parsed = schema.safeParse(this.mapDbRowPayload(row));
      if (!parsed.success) {
        throw new Error(`Invalid settings payload for ${path}`);
      }
      return parsed.data;
    });
  }

  getApiKeys(tenantId: string): Promise<SettingsApiKeys | null> {
    return this.readPath(tenantId, SETTINGS_API_KEYS_PATH, settingsApiKeysSchema);
  }

  updateApiKeys(payload: SettingsApiKeysMutation, tenantId: string): Promise<SettingsApiKeys> {
    return this.mergePath(tenantId, SETTINGS_API_KEYS_PATH, payload, settingsApiKeysSchema);
  }

  getProxy(tenantId: string): Promise<SettingsProxy | null> {
    return this.readPath(tenantId, SETTINGS_PROXY_PATH, settingsProxySchema);
  }

  updateProxy(payload: SettingsProxyMutation, tenantId: string): Promise<SettingsProxy> {
    return this.mergePath(tenantId, SETTINGS_PROXY_PATH, payload, settingsProxySchema);
  }

  getNotificationEvents(tenantId: string): Promise<SettingsNotificationEvents | null> {
    return this.readPath(
      tenantId,
      SETTINGS_NOTIFICATION_EVENTS_PATH,
      settingsNotificationEventsSchema,
    );
  }

  updateNotificationEvents(
    payload: SettingsNotificationEventsMutation,
    tenantId: string,
  ): Promise<SettingsNotificationEvents> {
    return this.mergePath(
      tenantId,
      SETTINGS_NOTIFICATION_EVENTS_PATH,
      payload,
      settingsNotificationEventsSchema,
    );
  }
}
