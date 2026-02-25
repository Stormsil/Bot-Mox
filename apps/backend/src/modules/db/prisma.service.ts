import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';

type ExtendableTransactionClient = Prisma.TransactionClient & {
  $extends?: (extension: unknown) => unknown;
};

type ExtendablePrismaClient = {
  $extends?: (extension: unknown) => unknown;
};

type QueryHookParams = {
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

const PAYLOAD_MODEL_NAMES = [
  'financeOperation',
  'resourceItem',
  'botEntity',
  'playbookItem',
  'workspaceItem',
  'themeAssetItem',
  'settingsItem',
  'provisioningProfileItem',
  'provisioningProgressItem',
  'licenseLeaseItem',
  'artifactReleaseItem',
  'artifactAssignmentItem',
  'provisioningTokenItem',
] as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly dataAtRestCrypto = new DataAtRestCrypto();
  private payloadCryptoClientCache: unknown | null = null;
  private readonly enforceTenantContext = String(process.env.ENFORCE_TENANT_CONTEXT || 'true')
    .trim()
    .toLowerCase();
  private readonly contextStorage = new AsyncLocalStorage<{
    tenantId: string | null;
    system: boolean;
  }>();
  private readonly tenantScopedModels = new Set<string>([
    'Agent',
    'AgentCommand',
    'ResourceItem',
    'WorkspaceItem',
    'FinanceOperation',
    'SecretMeta',
    'SecretBinding',
    'BotEntity',
    'PlaybookItem',
    'SettingsItem',
    'ThemeAssetItem',
    'LicenseLeaseItem',
    'ArtifactReleaseItem',
    'ArtifactAssignmentItem',
    'InfraVmItem',
    'InfraVmConfigItem',
    'ProvisioningProfileItem',
    'ProvisioningTokenItem',
    'ProvisioningProgressItem',
    'TenantProjectRollout',
    'TenantAccountAccess',
  ]);

  constructor() {
    super();
    const middlewareCapableClient = this as unknown as {
      $use?: (
        fn: (
          params: { model?: string; action: string },
          next: (params: { model?: string; action: string }) => Promise<unknown>,
        ) => Promise<unknown>,
      ) => void;
    };
    middlewareCapableClient.$use?.(async (params, next) => {
      if (!this.isTenantContextEnforced()) {
        return next(params);
      }

      const model = String(params.model || '').trim();
      if (!model || !this.tenantScopedModels.has(model)) {
        return next(params);
      }

      const context = this.contextStorage.getStore();
      const hasTenantContext = Boolean(String(context?.tenantId || '').trim());
      const isSystemContext = Boolean(context?.system);
      if (!hasTenantContext && !isSystemContext) {
        throw new Error(
          `Tenant context is required for Prisma ${model}.${params.action}. Use withTenantContext() or withSystemContext().`,
        );
      }

      return next(params);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  isTenantContextEnforced(): boolean {
    return this.enforceTenantContext === 'true';
  }

  async withTenantContext<T>(
    tenantId: string,
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const normalizedTenantId = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalizedTenantId) {
      throw new Error('tenantId is required for tenant-scoped transaction');
    }

    return this.runInContext(
      {
        tenantId: normalizedTenantId,
        system: false,
      },
      async () => {
        return this.$transaction(async (tx) => {
          await tx.$executeRaw`select set_config('app.tenant_id', ${normalizedTenantId}, true)`;
          return handler(this.withPayloadCryptoExtension(tx));
        });
      },
    );
  }

  async withSystemContext<T>(handler: () => Promise<T>): Promise<T> {
    return this.runInContext(
      {
        tenantId: null,
        system: true,
      },
      handler,
    );
  }

  getPayloadCryptoClient<T>(): T {
    if (this.payloadCryptoClientCache) {
      return this.payloadCryptoClientCache as T;
    }
    this.payloadCryptoClientCache = this.withPayloadCryptoExtension(this);
    return this.payloadCryptoClientCache as T;
  }

  private async runInContext<T>(
    context: { tenantId: string | null; system: boolean },
    handler: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.contextStorage.run(context, () => {
        void Promise.resolve(handler()).then(resolve).catch(reject);
      });
    });
  }

  private withPayloadCryptoExtension<T>(tx: T): T {
    const extendableTx = tx as T & ExtendablePrismaClient & ExtendableTransactionClient;
    if (typeof extendableTx.$extends !== 'function') {
      return tx;
    }

    const crypto = this.dataAtRestCrypto;
    const isEncryptedPayloadWrapper = (value: unknown): boolean =>
      Boolean(
        value &&
          typeof value === 'object' &&
          '__enc_payload_v1' in (value as Record<string, unknown>),
      );

    const decryptRowPayload = (row: unknown): unknown => {
      if (!row || typeof row !== 'object') return row;
      const record = row as Record<string, unknown>;
      const payload = record.payload;
      if (!payload || typeof payload !== 'object') return row;

      const wrapped = (payload as Record<string, unknown>).__enc_payload_v1;
      if (wrapped === undefined) return row;

      const decrypted = crypto.decryptJson<Record<string, unknown>>(wrapped);
      if (!decrypted || typeof decrypted !== 'object') return row;
      return { ...record, payload: decrypted };
    };

    const decryptQueryResult = (result: unknown): unknown =>
      Array.isArray(result)
        ? result.map((row) => decryptRowPayload(row))
        : decryptRowPayload(result);

    const encryptPayloadField = (input: unknown): unknown => {
      if (!input || typeof input !== 'object') return input;

      const record = input as Record<string, unknown>;
      if (!('payload' in record)) return input;

      const payload = record.payload;
      if (!payload || typeof payload !== 'object' || isEncryptedPayloadWrapper(payload))
        return input;
      return { ...record, payload: { __enc_payload_v1: crypto.encryptJson(payload) } };
    };

    const encryptArgsPayload = (args: unknown): unknown => {
      if (!args || typeof args !== 'object') return args;
      const record = args as Record<string, unknown>;
      const next = { ...record };
      if ('create' in next) next.create = encryptPayloadField(next.create);
      if ('update' in next) next.update = encryptPayloadField(next.update);
      if ('data' in next) next.data = encryptPayloadField(next.data);
      return next;
    };

    const readQuery = ({ args, query }: QueryHookParams) => query(args).then(decryptQueryResult);
    const writeQuery = async ({ args, query }: QueryHookParams) =>
      decryptQueryResult(await query(encryptArgsPayload(args)));

    const payloadModelHooks = {
      findMany: readQuery,
      findFirst: readQuery,
      upsert: writeQuery,
      create: writeQuery,
      update: writeQuery,
    };

    const extension = {
      query: Object.fromEntries(PAYLOAD_MODEL_NAMES.map((model) => [model, payloadModelHooks])),
    };

    return extendableTx.$extends(extension) as T;
  }
}
