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
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
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
const SETTINGS_THEME_PATH = 'settings/theme';
const SETTINGS_PROJECTS_PATH = 'settings/projects';
const SETTINGS_ALERTS_PATH = 'settings/alerts';
const SETTINGS_STORAGE_POLICY_PATH = 'settings/storage_policy';
const SETTINGS_UI_RESOURCE_TREE_PATH = 'settings/ui/resource_tree';
const SETTINGS_VMGENERATOR_PATH = 'settings/vmgenerator';
const SETTINGS_VMGENERATOR_TASK_LOGS_PATH = 'settings/vmgenerator/task_logs';
const DEFAULT_SETTINGS_ALERTS = { warning_days: 7 };
const DEFAULT_SETTINGS_RESOURCE_TREE = {
  expandedKeys: [] as string[],
  visibleStatuses: [] as string[],
  showFilters: true,
};
const DEFAULT_SETTINGS_PROJECTS: Record<string, unknown> = {};
const DEFAULT_SETTINGS_STORAGE_POLICY: Record<string, unknown> = {};
const DEFAULT_SETTINGS_THEME: Record<string, unknown> = {};
const DEFAULT_SETTINGS_VMGENERATOR: Record<string, unknown> = {};
const DEFAULT_SETTINGS_VMGENERATOR_TASK_LOGS: unknown[] = [];
const DEFAULT_SETTINGS_API_KEYS: Record<string, unknown> = {};
const DEFAULT_SETTINGS_PROXY: Record<string, unknown> = {};
const DEFAULT_SETTINGS_NOTIFICATION_EVENTS: Record<string, unknown> = {};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class SettingsService {
  private readonly atRestCrypto = new DataAtRestCrypto();

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
    const payload = this.clone(row.payload);
    if (!isPlainObject(payload)) {
      return payload;
    }
    const wrapped = payload.__enc_payload_v1;
    if (wrapped === undefined) {
      return payload;
    }
    const decrypted = this.atRestCrypto.decryptJson<unknown>(wrapped);
    return decrypted ?? payload;
  }

  private encryptSettingsPayload(payload: unknown): Record<string, unknown> {
    return {
      __enc_payload_v1: this.atRestCrypto.encryptJson(this.clone(payload)),
    };
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
        payload: this.encryptSettingsPayload(next) as Prisma.InputJsonValue,
      });
      const parsed = schema.safeParse(this.mapDbRowPayload(row));
      if (!parsed.success) {
        throw new Error(`Invalid settings payload for ${path}`);
      }
      return parsed.data;
    });
  }

  private readRawPath(tenantId: string, path: string): Promise<unknown | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository
      .findByPath(normalizedTenantId, path)
      .then((row) => (row ? this.mapDbRowPayload(row) : null));
  }

  private writeRawPath(tenantId: string, path: string, payload: unknown): Promise<unknown> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository
      .upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.encryptSettingsPayload(payload) as Prisma.InputJsonValue,
      })
      .then((row) => this.mapDbRowPayload(row));
  }

  private patchRawPath(tenantId: string, path: string, patch: unknown): Promise<unknown> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository.findByPath(normalizedTenantId, path).then(async (existing) => {
      const current = existing ? this.mapDbRowPayload(existing) : {};
      const currentObj = isPlainObject(current) ? current : {};
      const patchObj = isPlainObject(patch) ? patch : {};
      const next: Record<string, unknown> = { ...currentObj, ...patchObj };
      for (const [key, value] of Object.entries(next)) {
        if (value === null) {
          delete next[key];
        }
      }
      const row = await this.repository.upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.encryptSettingsPayload(next) as Prisma.InputJsonValue,
      });
      return this.mapDbRowPayload(row);
    });
  }

  getApiKeys(tenantId: string): Promise<SettingsApiKeys | null> {
    return this.readPath(tenantId, SETTINGS_API_KEYS_PATH, settingsApiKeysSchema).then(
      (value) => (value ?? this.clone(DEFAULT_SETTINGS_API_KEYS)) as SettingsApiKeys,
    );
  }

  updateApiKeys(payload: SettingsApiKeysMutation, tenantId: string): Promise<SettingsApiKeys> {
    return this.mergePath(tenantId, SETTINGS_API_KEYS_PATH, payload, settingsApiKeysSchema);
  }

  getProxy(tenantId: string): Promise<SettingsProxy | null> {
    return this.readPath(tenantId, SETTINGS_PROXY_PATH, settingsProxySchema).then(
      (value) => (value ?? this.clone(DEFAULT_SETTINGS_PROXY)) as SettingsProxy,
    );
  }

  updateProxy(payload: SettingsProxyMutation, tenantId: string): Promise<SettingsProxy> {
    return this.mergePath(tenantId, SETTINGS_PROXY_PATH, payload, settingsProxySchema);
  }

  getNotificationEvents(tenantId: string): Promise<SettingsNotificationEvents | null> {
    return this.readPath(tenantId, SETTINGS_NOTIFICATION_EVENTS_PATH, settingsNotificationEventsSchema).then(
      (value) => (value ?? this.clone(DEFAULT_SETTINGS_NOTIFICATION_EVENTS)) as SettingsNotificationEvents,
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

  getTheme(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_THEME_PATH).then((value) => value ?? DEFAULT_SETTINGS_THEME);
  }

  updateTheme(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_THEME_PATH, payload ?? {});
  }

  getProjects(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_PROJECTS_PATH).then((value) => value ?? DEFAULT_SETTINGS_PROJECTS);
  }

  async upsertProject(projectId: string, payload: unknown, tenantId: string): Promise<unknown> {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      throw new Error('projectId is required');
    }
    const current = await this.readRawPath(tenantId, SETTINGS_PROJECTS_PATH);
    const nextProjects = {
      ...(isPlainObject(current) ? current : {}),
      [normalizedProjectId]: payload,
    };
    return this.writeRawPath(tenantId, SETTINGS_PROJECTS_PATH, nextProjects);
  }

  patchProjects(payload: unknown, tenantId: string): Promise<unknown> {
    return this.patchRawPath(tenantId, SETTINGS_PROJECTS_PATH, payload);
  }

  getResourceTree(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_UI_RESOURCE_TREE_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_RESOURCE_TREE,
    );
  }

  updateResourceTree(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_UI_RESOURCE_TREE_PATH, payload ?? {});
  }

  getAlerts(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_ALERTS_PATH).then((value) => value ?? DEFAULT_SETTINGS_ALERTS);
  }

  updateAlerts(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_ALERTS_PATH, payload ?? {});
  }

  getStoragePolicy(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_STORAGE_POLICY_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_STORAGE_POLICY,
    );
  }

  updateStoragePolicy(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_STORAGE_POLICY_PATH, payload ?? {});
  }

  getVmGenerator(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_VMGENERATOR_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_VMGENERATOR,
    );
  }

  updateVmGenerator(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_VMGENERATOR_PATH, payload ?? {});
  }

  getVmGeneratorTaskLogs(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_VMGENERATOR_TASK_LOGS_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_VMGENERATOR_TASK_LOGS,
    );
  }

  updateVmGeneratorTaskLogs(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_VMGENERATOR_TASK_LOGS_PATH, payload ?? []);
  }
}
