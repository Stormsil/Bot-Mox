import {
  type settingsApiKeysMutationSchema,
  settingsApiKeysSchema,
  type settingsNotificationEventsMutationSchema,
  settingsNotificationEventsSchema,
  type settingsProxyMutationSchema,
  settingsProxySchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';

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
  private readonly store = new Map<string, unknown>();

  private clone<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private readPath<T>(
    path: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): T | null {
    const rawValue = this.clone(this.store.get(path));
    const parsed = schema.safeParse(rawValue);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  }

  private mergePath<T>(
    path: string,
    payload: unknown,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): T {
    const current = this.store.get(path);
    let next: unknown = payload;
    if (isPlainObject(current) && isPlainObject(payload)) {
      next = { ...current, ...payload };
    }

    this.store.set(path, this.clone(next));
    const parsed = schema.safeParse(this.store.get(path));
    if (!parsed.success) {
      throw new Error(`Invalid settings payload for ${path}`);
    }
    return parsed.data;
  }

  getApiKeys(): SettingsApiKeys | null {
    return this.readPath(SETTINGS_API_KEYS_PATH, settingsApiKeysSchema);
  }

  updateApiKeys(payload: SettingsApiKeysMutation): SettingsApiKeys {
    return this.mergePath(SETTINGS_API_KEYS_PATH, payload, settingsApiKeysSchema);
  }

  getProxy(): SettingsProxy | null {
    return this.readPath(SETTINGS_PROXY_PATH, settingsProxySchema);
  }

  updateProxy(payload: SettingsProxyMutation): SettingsProxy {
    return this.mergePath(SETTINGS_PROXY_PATH, payload, settingsProxySchema);
  }

  getNotificationEvents(): SettingsNotificationEvents | null {
    return this.readPath(SETTINGS_NOTIFICATION_EVENTS_PATH, settingsNotificationEventsSchema);
  }

  updateNotificationEvents(
    payload: SettingsNotificationEventsMutation,
  ): SettingsNotificationEvents {
    return this.mergePath(
      SETTINGS_NOTIFICATION_EVENTS_PATH,
      payload,
      settingsNotificationEventsSchema,
    );
  }
}
