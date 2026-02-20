import { Injectable, Logger } from '@nestjs/common';

type VaultMode = 'shadow' | 'enforced';

interface StoreSecretMaterialInput {
  tenantId: string;
  secretId: string;
  ciphertext: string;
  nonce: string;
  keyId: string;
  alg: string;
}

interface StoreSecretMaterialResult {
  vaultRef: string;
  materialVersion: number;
}

interface RpcStoreResponse {
  vault_ref?: string;
  material_version?: number;
}

@Injectable()
export class SecretsVaultAdapter {
  private readonly logger = new Logger(SecretsVaultAdapter.name);
  private readonly mode: VaultMode = this.resolveMode();

  private readonly supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  private readonly supabaseServiceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  private readonly vaultRpcName = String(process.env.SUPABASE_VAULT_RPC_NAME || '').trim();

  async storeMaterial(input: StoreSecretMaterialInput): Promise<StoreSecretMaterialResult> {
    return this.upsertMaterial(input, 1);
  }

  async rotateMaterial(input: StoreSecretMaterialInput): Promise<StoreSecretMaterialResult> {
    return this.upsertMaterial(input, 2);
  }

  private async upsertMaterial(
    input: StoreSecretMaterialInput,
    fallbackVersion: number,
  ): Promise<StoreSecretMaterialResult> {
    const rpcResult = await this.tryStoreViaSupabaseRpc(input, fallbackVersion).catch(
      (error: unknown) => {
        if (this.mode === 'shadow') {
          this.logger.error(
            `Vault RPC unavailable in shadow mode; local fallback is disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        throw error;
      },
    );
    return rpcResult;
  }

  private async tryStoreViaSupabaseRpc(
    input: StoreSecretMaterialInput,
    fallbackVersion: number,
  ): Promise<StoreSecretMaterialResult> {
    if (!this.supabaseUrl || !this.supabaseServiceRoleKey || !this.vaultRpcName) {
      throw new Error(
        'Supabase Vault configuration missing (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_VAULT_RPC_NAME)',
      );
    }

    const response = await fetch(
      `${this.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${this.vaultRpcName}`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabaseServiceRoleKey,
          authorization: `Bearer ${this.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
          prefer: 'return=representation',
        },
        body: JSON.stringify({
          p_tenant_id: input.tenantId,
          p_secret_id: input.secretId,
          p_ciphertext: input.ciphertext,
          p_nonce: input.nonce,
          p_key_id: input.keyId,
          p_alg: input.alg,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Supabase vault RPC failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as RpcStoreResponse;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Supabase vault RPC returned invalid payload');
    }

    const vaultRef = String(payload.vault_ref || '').trim();
    if (!vaultRef) {
      throw new Error('Supabase vault RPC did not return vault_ref');
    }

    const version = Number(payload.material_version || 1);
    return {
      vaultRef,
      materialVersion:
        Number.isFinite(version) && version > 0 ? Math.trunc(version) : fallbackVersion,
    };
  }

  private resolveMode(): VaultMode {
    const mode = String(process.env.SECRETS_VAULT_MODE || 'shadow')
      .trim()
      .toLowerCase();
    if (mode === 'enforced') {
      return 'enforced';
    }
    return 'shadow';
  }
}
