import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
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
          return handler(tx);
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
}
